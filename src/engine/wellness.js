// Daily Wellness Status engine: formulas F1 to F7 (PRD v4 section 6).
// Plain arithmetic, deterministic and versioned. Same inputs + same version = same number.

import {
  clamp, round, median, mad, mean, sum, addDays, circularMeanMin, circularDiffMin,
  daysBetween, ageFrom,
} from './util.js';

export const ENGINE_VERSION = 'v4.2-draft';
export const WEIGHTS = { sleep: 0.30, recovery: 0.25, activity: 0.20, nutrition: 0.15, hydration: 0.10 };

export const BANDS = [
  { min: 80, name: 'Thrive', advice: 'Go for it', color: 'green' },
  { min: 65, name: 'Steady', advice: 'Normal day', color: 'teal' },
  { min: 50, name: 'Ease up', advice: 'Lighter day', color: 'amber' },
  { min: 0, name: 'Recover', advice: 'Rest and refuel', color: 'coral' },
];
export const bandFor = (ws) => BANDS.find((b) => ws >= b.min);

// ---------------- F1 personal baselines ----------------
export function baseline(values, floor) {
  const v = values.filter((x) => x != null);
  if (!v.length) return { mu: null, sigma: null, n: 0 };
  const mu = median(v);
  const sigma = Math.max(1.4826 * (mad(v) || 0), floor);
  return { mu, sigma, n: v.length };
}

export function recoveryBaselines(nights, today) {
  // nights: wearable nights sorted by date; baseline uses the 30 valid days before today.
  const prior = nights.filter((n) => n.date < today && daysBetween(n.date, today) <= 30 && !n.flagged);
  const lnH = prior.filter((n) => n.hrv).map((n) => Math.log(n.hrv));
  const rhr = prior.filter((n) => n.rhr).map((n) => n.rhr);
  const bH = baseline(lnH, 0.05);
  const bR = baseline(rhr, 1);
  const last7 = nights.filter((n) => n.date <= today && daysBetween(n.date, today) < 7 && n.hrv);
  const h7 = last7.length >= 4 ? mean(last7.map((n) => Math.log(n.hrv))) : null; // F1.3
  const tonight = nights.find((n) => n.date === today);
  const active = bH.n >= 14; // F1.5
  let z = null, delta = null;
  if (bH.mu != null && h7 != null) z = (h7 - bH.mu) / bH.sigma; // F1.4
  if (bR.mu != null && tonight?.rhr) delta = tonight.rhr - bR.mu;
  return {
    validNights: Math.max(bH.n, bR.n), active, z, delta, h7,
    hrvBaselineMs: bH.mu != null ? Math.exp(bH.mu) : null,
    hrvSigma: bH.sigma, rhrBaseline: bR.mu, rhrSigma: bR.sigma,
    normalForYou: z != null && delta != null && Math.abs(z) < 0.5 && Math.abs(delta) <= 3, // F1.7
  };
}

// ---------------- F2 sleep ----------------
export function sleepNeed(profile, nights, today) {
  if (profile.sleepNeedH) return { N: profile.sleepNeedH, learned: false };
  const isTeen = ageFrom(profile.dob, today) < 18;
  const [nmin, nmax] = isTeen ? [8, 10] : [7, 9];
  // Free day = Saturday or Sunday wake (no alarm) for the demo.
  const free = nights
    .filter((n) => n.date <= today && daysBetween(n.date, today) < 14 && [0, 6].includes(new Date(n.date + 'T12:00').getDay()))
    .map((n) => n.tstH);
  if (free.length < 2) return { N: isTeen ? 9 : 8, learned: false };
  return { N: round(clamp(median(free), nmin, nmax), 2), learned: true };
}

export function durationScore(t, N) {
  if (t >= N - 0.5 && t <= N + 1) return 100;
  if (t < N - 0.5) return Math.max(0, 100 - 25 * (N - 0.5 - t));
  return Math.max(0, 100 - 10 * (t - N - 1));
}

export function sleepScore({ night, priorNights, N, rating }) {
  if (!night || night.tstH == null) return null;
  const t = night.tstH;
  const D = durationScore(t, N); // F2.2
  let Q;
  let qSource;
  if (night.eff != null) {
    const effPct = night.eff <= 1 ? 100 * night.eff : night.eff; // F0.2
    Q = clamp(5 * (effPct - 75), 0, 100); // F2.3
    qSource = `efficiency ${round(effPct)}%`;
  } else {
    const r = rating ?? night.rating ?? 3;
    Q = 25 * (r - 1);
    qSource = `your rating ${r} of 5`;
  }
  let R = 100, dev = null;
  if (night.midMin != null) {
    const mids = priorNights.filter((n) => n.midMin != null).slice(-7).map((n) => n.midMin);
    if (mids.length >= 3) {
      dev = circularDiffMin(night.midMin, circularMeanMin(mids)); // F2.4
      R = clamp(100 - Math.max(0, dev - 30), 0, 100); // F2.5
    }
  }
  const score = 0.5 * D + 0.25 * Q + 0.25 * R; // F2.7
  const confidence = night.stages ? 'High' : night.source === 'manual' ? 'Low' : 'Medium'; // F2.8
  return { score: round(score, 1), D: round(D, 2), Q: round(Q, 1), R: round(R, 1), t, N, dev, qSource, confidence };
}

// ---------------- F3 recovery ----------------
export function checkinScore(c) {
  if (!c || c.energy == null || c.soreness == null || c.stress == null) return null;
  return (((c.energy - 1) + (5 - c.soreness) + (5 - c.stress)) / 12) * 100; // F3.3
}

export function recoveryScore({ base, checkin, wearable, cycleAdj, nightsWithHrv }) {
  const CHK = checkinScore(checkin);
  if (!wearable) {
    return CHK == null ? null : { score: round(CHK, 1), CHK: round(CHK, 1), mode: 'phone', parts: { CHK } };
  }
  let z = base.z, delta = base.delta;
  let adjusted = false;
  if (cycleAdj && z != null && delta != null) {
    // F3.5 / F8.10
    delta = delta - cycleAdj.dRhr;
    z = z - cycleAdj.dh / (base.hrvSigma || 0.05);
    adjusted = true;
  }
  const HRVs = z == null ? null : clamp(70 + 20 * z, 0, 100); // F3.1
  const RHRs = delta == null ? null : clamp(80 - 6 * delta, 0, 100); // F3.2
  let score, mode;
  if (base.active && HRVs != null && RHRs != null) {
    if (CHK != null) score = 0.4 * HRVs + 0.3 * RHRs + 0.3 * CHK; // F3.4 wearable
    else score = (0.4 * HRVs + 0.3 * RHRs) / 0.7;
    mode = 'wearable';
  } else if ((nightsWithHrv ?? 0) >= 3 && RHRs != null) {
    score = CHK != null ? 0.8 * CHK + 0.2 * RHRs : RHRs; // calibrating
    mode = 'calibrating';
  } else if (CHK != null) {
    score = CHK;
    mode = 'calibrating';
  } else return null;
  return {
    score: round(score, 1), mode, adjusted,
    HRVs: HRVs == null ? null : round(HRVs, 1), RHRs: RHRs == null ? null : round(RHRs, 1),
    CHK: CHK == null ? null : round(CHK, 1), z: z == null ? null : round(z, 2), delta: delta == null ? null : round(delta, 1),
  };
}

// ---------------- F4 activity and load ----------------
export function stepTarget(profile, stepsByDate, today) {
  const age = ageFrom(profile.dob, today);
  const cap = age >= 60 ? 8000 : 10000;
  const last14 = [];
  for (let i = 1; i <= 14; i++) {
    const s = stepsByDate[addDays(today, -i)];
    if (s != null) last14.push(s);
  }
  if (last14.length < 7) return { T: age >= 60 ? 7000 : 8000, cap, learned: false };
  return { T: round(clamp(median(last14), 3000, cap), -2), cap, learned: true }; // F4.1
}

export function hrMax(profile, today, workouts) {
  const age = ageFrom(profile.dob, today);
  const predicted = 208 - 0.7 * age; // F4.4
  const observed = workouts
    .filter((w) => w.maxHr && daysBetween(w.date, today) <= 90)
    .map((w) => w.maxHr);
  const best = observed.length ? Math.max(...observed) : null;
  return { predicted: round(predicted), observed: best, value: best && best > predicted * 0.9 ? Math.max(best, predicted) : predicted };
}

export function intensityMinutes(w, hrmax) {
  // moderate = 64-76% HRmax or RPE 3-5.9; vigorous >= 77% HRmax or RPE >= 6
  if (w.zones) {
    const mod = (w.zones[2] || 0) + (w.zones[3] || 0) * 0.5;
    const vig = (w.zones[3] || 0) * 0.5 + (w.zones[4] || 0) + (w.zones[5] || 0);
    return { mod, vig };
  }
  if (w.avgHr && hrmax) {
    const p = w.avgHr / hrmax;
    if (p >= 0.77) return { mod: 0, vig: w.minutes };
    if (p >= 0.64) return { mod: w.minutes, vig: 0 };
    return { mod: 0, vig: 0 };
  }
  const rpe = w.rpe ?? 5;
  if (w.strength) return { mod: 0, vig: 0 };
  if (rpe >= 6) return { mod: 0, vig: w.minutes };
  if (rpe >= 3) return { mod: w.minutes, vig: 0 };
  return { mod: 0, vig: 0 };
}

export function isEffectiveStrength(w) {
  // F4.6: >= 4 working sets covering >= 2 major muscle groups, or >= 20 min of resistance work
  if (!w.strength) return false;
  if ((w.workingSets ?? 0) >= 4 && (w.muscleGroups?.length ?? 0) >= 2) return true;
  return (w.minutes ?? 0) >= 20;
}

export function sessionLoad(w, hrmax) {
  // F4.8: TRIMP from zones when present, else RPE x minutes
  if (w.zones) return sum(Object.entries(w.zones).map(([z, m]) => Number(z) * m));
  return (w.rpe ?? (w.strength ? 6 : 4)) * (w.minutes ?? 0);
}

export function loadBalance(workouts, today, hrmaxV) {
  const loadOn = (from, to) =>
    sum(workouts.filter((w) => w.date > addDays(today, -from) && w.date <= addDays(today, -to)).map((w) => sessionLoad(w, hrmaxV)));
  const acute = loadOn(7, 0);
  const chronic = loadOn(28, 0) / 4;
  const acwr = chronic === 0 ? 1 : acute / chronic; // F4.9
  let LB = 100; // F4.10
  if (acwr > 2.0) LB = 40;
  else if (acwr > 1.5) LB = 60;
  else if (acwr > 1.3) LB = 80;
  else if (acwr < 0.8) LB = 90;
  return { acute: round(acute), chronic: round(chronic, 1), acwr: round(acwr, 2), LB };
}

export function activityScore({ profile, stepsByDate, workouts, today, hasSteps }) {
  const yesterday = addDays(today, -1);
  const tgt = stepTarget(profile, stepsByDate, today);
  const ySteps = stepsByDate[yesterday];
  const hm = hrMax(profile, today, workouts).value;
  const week = workouts.filter((w) => w.date > addDays(today, -7) && w.date <= today);
  let mod = 0, vig = 0;
  for (const w of week) {
    const m = intensityMinutes(w, hm);
    mod += m.mod;
    vig += m.vig;
  }
  const mvpa7 = mod + 2 * vig; // F4.5
  const strengthSessions = week.filter(isEffectiveStrength).length;
  if (!hasSteps && !week.length) return null;
  const A1 = ySteps != null ? Math.min(100, (100 * ySteps) / tgt.T) : null; // F4.3
  const A2 = Math.min(100, (100 * mvpa7) / 150);
  const A3 = Math.min(100, 50 * strengthSessions); // F4.6
  const score = A1 != null ? 0.4 * A1 + 0.4 * A2 + 0.2 * A3 : (0.4 * A2 + 0.2 * A3) / 0.6; // F4.7
  return {
    score: round(score, 1), A1: A1 == null ? null : round(A1, 1), A2: round(A2, 1), A3, steps: ySteps,
    target: tgt.T, mvpa7: round(mvpa7), strengthSessions, modMin: round(mod), vigMin: round(vig),
  };
}

// ---------------- F5 nutrition ----------------
export function energyNeed(profile, today, avgSteps, mvpa7) {
  const age = ageFrom(profile.dob, today);
  const kg = profile.weightKg || 70;
  const cm = profile.heightCm || 170;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  const eq = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78; // F5.1
  const REE = base + eq;
  const afSteps = avgSteps == null ? 1.2 : avgSteps < 5000 ? 1.2 : avgSteps < 7500 ? 1.375 : avgSteps < 10000 ? 1.55 : 1.725;
  const afM = mvpa7 < 60 ? 1.2 : mvpa7 < 150 ? 1.375 : mvpa7 < 300 ? 1.55 : 1.725;
  const AF = Math.max(afSteps, afM); // F5.2
  const safety = profile.edFlag || profile.pregnant || age < 18;
  const g = safety ? 1.0 : profile.weightGoal === 'lose' ? 0.9 : profile.weightGoal === 'gain' ? 1.1 : 1.0;
  const floor = profile.sex === 'male' ? 1500 : 1200;
  return { REE: round(REE), AF, g, need: round(Math.max(floor, REE * AF * g)) }; // F5.3
}

export function nutritionScore({ profile, meals, caffeine, alcohol, need, bedtimeMin, proteinTarget }) {
  const usual = profile.usualMeals || 3;
  const confirmed = meals.filter((m) => m.confirmed).length;
  const unconfirmed = meals.filter((m) => !m.confirmed).length;
  const cov = Math.min(1, (confirmed + 0.5 * unconfirmed) / usual); // F5.4
  if (cov === 0) return null;
  const kcal = sum(meals.map((m) => m.kcal || 0));
  const protein = sum(meals.map((m) => m.protein || 0));
  const fiber = sum(meals.map((m) => m.fiber || 0));
  const kcalH = kcal / cov, proteinH = protein / cov, fiberH = fiber / cov; // F5.5
  const r = kcalH / need;
  let E; // F5.6
  if (r < 0.7) E = Math.min(40, 100 - 200 * (0.85 - r));
  else if (Math.abs(r - 1) <= 0.15) E = 100;
  else E = Math.max(20, 100 - 200 * (Math.abs(r - 1) - 0.15));
  const kg = profile.weightKg || 70;
  const pt = proteinTarget || 1.2;
  const P = Math.min(100, (100 * proteinH) / (pt * kg)); // F5.7
  const F = Math.min(100, (100 * fiberH) / ((14 * need) / 1000)); // F5.8
  // F5.9 timing
  let lateCaf = 0;
  const lastCaf = caffeine.length ? caffeine.reduce((a, b) => (a.minute > b.minute ? a : b)) : null;
  if (lastCaf) {
    const totalMg = sum(caffeine.map((c) => c.mg || 95));
    const hoursToBed = ((bedtimeMin - lastCaf.minute + 1440) % 1440) / 60;
    lateCaf = hoursToBed < (totalMg > 150 ? 13.2 : 8.8) ? 1 : 0;
  }
  const TM = Math.max(0, 100 - 30 * lateCaf - 15 * Math.max(0, (alcohol || 0) - 1));
  const ed = profile.edFlag;
  const score = ed ? 0.4 * P + 0.35 * F + 0.25 * TM : 0.3 * E + 0.3 * P + 0.25 * F + 0.15 * TM; // F5.10
  return {
    score: round(score, 1), cov: round(cov, 2), confirmed, unconfirmed, usual,
    E: ed ? null : round(E, 1), P: round(P, 1), F: round(F, 1), TM, lateCaf: !!lateCaf,
    kcal: round(kcal), protein: round(protein), fiber: round(fiber), need, r: round(r, 2),
    proteinTargetG: round(pt * kg), fiberTargetG: round((14 * need) / 1000),
  };
}

// ---------------- F6 hydration ----------------
export function waterTarget(profile, exerciseHours = 0, hot = false) {
  const base = round(33 * (profile.weightKg || 70) + 500 * exerciseHours, -1);
  return round(base * (hot ? 1.1 : 1), -1); // F6.1
}
export function hydrationScore({ fluidMl, target }) {
  if (!fluidMl) return null; // weight 0.10 only when water logged
  const score = Math.min(100, (100 * fluidMl) / target); // F6.2
  return { score: round(score, 1), fluid: fluidMl, target, overdrinking: fluidMl > 1.5 * target };
}

// ---------------- F7 fusion, caps and outputs ----------------
export function fuse({ sleep, recovery, activity, nutrition, hydration, illness, wearable, tstH, z, delta }) {
  const e = {
    sleep: sleep ? WEIGHTS.sleep : 0,
    recovery: recovery ? WEIGHTS.recovery : 0,
    activity: activity ? WEIGHTS.activity : 0,
    nutrition: nutrition ? WEIGHTS.nutrition * nutrition.cov : 0, // F7.1
    hydration: hydration ? WEIGHTS.hydration : 0,
  };
  const TW = sum(Object.values(e));
  const eligible = TW >= 0.5 && !!(sleep || recovery); // F7.2
  const scores = {
    sleep: sleep?.score, recovery: recovery?.score, activity: activity?.score,
    nutrition: nutrition?.score, hydration: hydration?.score,
  };
  const RAW = TW > 0 ? sum(Object.keys(e).map((k) => e[k] * (scores[k] || 0))) / TW : null; // F7.3
  let CAP = 100, capReason = null; // F7.4
  if (illness) { CAP = 49; capReason = 'You told us you feel unwell, so today is a Recover day.'; }
  else if (wearable && z != null && z < -2 && delta != null && delta >= 7) {
    CAP = 59; capReason = 'HRV is well below your normal and resting heart rate is 7+ bpm above it.';
  } else if (tstH != null && tstH < 4) { CAP = 59; capReason = 'Under 4 hours of sleep caps today at 59.'; }
  const WS = eligible && RAW != null ? round(Math.min(RAW, CAP)) : null; // F7.5
  return { e, TW: round(TW, 3), RAW: RAW == null ? null : round(RAW, 1), CAP, capReason, capped: RAW != null && RAW > CAP, eligible, WS };
}

export function readiness(sleep, recovery, LB) {
  if (!sleep && !recovery) return null;
  const s = sleep?.score ?? recovery.score;
  const r = recovery?.score ?? sleep.score;
  return round(0.45 * s + 0.4 * r + 0.15 * LB); // F7.7
}

export function confidence(wearable, cov) {
  // F7.8
  if (wearable && cov >= 0.67) return 'High';
  if (wearable) return 'Medium';
  if (cov >= 0.67) return 'Medium';
  return 'Low';
}
