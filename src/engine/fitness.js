// Fitness and training engine: formulas F12.1 to F12.23 (PRD v4 section 6.5).

import { clamp, round, mean, sd, sum, addDays, daysBetween, ageFrom } from './util.js';
import { isEffectiveStrength, intensityMinutes, sessionLoad, hrMax } from './wellness.js';

export const EXERCISES = {
  bench: { name: 'Bench press', groups: ['chest', 'triceps'], upper: true, range: [6, 10] },
  row: { name: 'Barbell row', groups: ['back', 'biceps'], upper: true, range: [6, 10] },
  ohp: { name: 'Overhead press', groups: ['shoulders', 'triceps'], upper: true, range: [6, 10] },
  pulldown: { name: 'Lat pulldown', groups: ['back', 'biceps'], upper: true, range: [8, 12] },
  squat: { name: 'Back squat', groups: ['quads', 'glutes'], upper: false, range: [5, 8] },
  rdl: { name: 'Romanian deadlift', groups: ['hamstrings', 'glutes'], upper: false, range: [6, 10] },
  lunge: { name: 'Walking lunge', groups: ['quads', 'glutes'], upper: false, range: [8, 12] },
  pushup: { name: 'Push-up', groups: ['chest', 'triceps'], upper: true, range: [8, 15], bodyweight: true },
  goblet: { name: 'Goblet squat', groups: ['quads', 'glutes'], upper: false, range: [8, 12] },
};

// F12.10 templates
export const TEMPLATES = {
  strength: { sets: [3, 5], reps: [3, 6], rir: [1, 3], label: 'Strength' },
  muscle: { sets: [3, 4], reps: [6, 12], rir: [1, 3], label: 'Muscle' },
  general: { sets: [2, 3], reps: [8, 12], rir: [2, 3], label: 'General fitness' },
  endurance: { sets: [2, 3], reps: [12, 20], rir: [2, 3], label: 'Endurance' },
  sport: { sets: [3, 4], reps: [5, 8], rir: [2, 3], label: 'Sport' },
};

export const SPLITS = {
  2: [['Full body A', ['squat', 'bench', 'row']], ['Full body B', ['rdl', 'ohp', 'pulldown']]],
  3: [['Upper body', ['bench', 'row', 'ohp']], ['Lower body', ['squat', 'rdl', 'lunge']], ['Full body', ['goblet', 'pushup', 'pulldown']]],
  4: [['Upper body', ['bench', 'row', 'ohp']], ['Lower body', ['squat', 'rdl', 'lunge']], ['Upper body B', ['pushup', 'pulldown', 'ohp']], ['Lower body B', ['goblet', 'rdl', 'lunge']]],
};

export const e1rm = (load, reps, rir = 0) => load * (1 + (reps + rir) / 30); // F12.9

export function roundToPlates(kg, upper) {
  const step = 2.5; // smallest pair of plates = 2 x 1.25 kg
  return Math.max(step, Math.round(kg / step) * step);
}

// F12.12 '2-for-2' load progression from the last two sessions of a lift.
export function nextLoad(exId, sets, goal = 'muscle') {
  const ex = EXERCISES[exId];
  const sessions = groupSessions(sets.filter((s) => s.exercise === exId));
  if (!sessions.length) return { load: null, reason: 'First session: pick a load you can lift for the top of the range with 2 to 3 reps in reserve.' };
  const [lo, hi] = ex.range;
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const lastSet = (s) => s.sets[s.sets.length - 1];
  const beat = (s) => lastSet(s).reps >= hi + 2;
  const failed = (s) => lastSet(s).reps < lo && (lastSet(s).rir ?? 1) === 0;
  const load = lastSet(last).load;
  if (prev && beat(last) && beat(prev)) {
    const f = ex.upper ? 1.025 : 1.05;
    const nl = roundToPlates(load * f, ex.upper);
    return { load: nl === load ? load + 2.5 : nl, change: 'up', reason: `You beat ${hi} reps by 2+ in your last two sessions, so the load goes up.` };
  }
  if (prev && failed(last) && failed(prev)) {
    return { load: roundToPlates(load * 0.95), change: 'down', reason: `Reps fell below ${lo} at 0 in reserve twice, so we drop 5% and rebuild.` };
  }
  return { load, change: 'same', reason: `Repeat ${load} kg and aim for ${hi} reps on the last set.` };
}

function groupSessions(sets) {
  const by = {};
  for (const s of sets) (by[s.date] ||= []).push(s);
  return Object.keys(by).sort().map((d) => ({ date: d, sets: by[d] }));
}

// F12.17 readiness-guided session verdict
export function sessionVerdict(ready, wsCapped) {
  if (ready == null) return { verdict: 'As planned', code: 'planned', note: 'No readiness yet; train as planned and keep 2 reps in reserve.' };
  if (ready < 50 || wsCapped) return { verdict: 'Rest', code: 'rest', note: 'Readiness is low, so today becomes rest, a walk or mobility.' };
  if (ready < 60) return { verdict: 'Lighter', code: 'lighter', note: 'Readiness is under 60: cut volume by about a third or swap to zone 2.' };
  if (ready < 75) return { verdict: 'As planned', code: 'planned', note: 'Train as planned with 2+ reps in reserve and no new maxes.' };
  return { verdict: 'Push', code: 'push', note: 'Readiness is high: train as planned, and you may add a set.' };
}

// F12.3 / F12.2 VO2max source priority
export function vo2max(profile, today, nights, workouts, tests = []) {
  const recentTest = tests.filter((t) => daysBetween(t.date, today) <= 84).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (recentTest) return { value: round(recentTest.vo2, 1), source: `Field test (${recentTest.method})`, confidence: 'High' };
  const dev = nights.filter((n) => n.vo2max).slice(-1)[0];
  if (dev) return { value: round(dev.vo2max, 1), source: 'Device estimate', confidence: 'Medium' };
  const hm = hrMax(profile, today, workouts);
  const rhrs = nights.filter((n) => n.rhr && daysBetween(n.date, today) < 14).map((n) => n.rhr);
  if (hm.observed && hm.observed >= 0.9 * hm.predicted && rhrs.length) {
    return { value: round((15.3 * hm.observed) / mean(rhrs), 1), source: 'Heart-rate ratio', confidence: 'Low' };
  }
  return null;
}

// FRIEND percentile tables are pending a licence (PRD open decision); this
// approximates them with a normal curve by age and sex. Labelled in the UI.
export function crfPercentile(vo2, age, sex) {
  const male = sex === 'male';
  const m = (male ? 48 : 38) - 0.33 * Math.max(0, age - 25);
  const s = male ? 8.5 : 7.5;
  const zz = (vo2 - m) / s;
  const p = 1 / (1 + Math.exp(-1.702 * zz));
  return round(100 * p);
}

export function fitnessScore({ profile, today, nights, workouts, sets, tests }) {
  const age = ageFrom(profile.dob, today);
  const vo2 = vo2max(profile, today, nights, workouts, tests);
  const CRF = vo2 ? crfPercentile(vo2.value, age, profile.sex) : null; // F12.5
  // F12.6 strength
  const weeks = [];
  for (let w = 0; w < 8; w++) {
    const to = addDays(today, -7 * w), from = addDays(to, -7);
    const wk = workouts.filter((x) => x.date > from && x.date <= to);
    const hm = hrMax(profile, today, workouts).value;
    let mvpa = 0;
    for (const x of wk) { const im = intensityMinutes(x, hm); mvpa += im.mod + 2 * im.vig; }
    weeks.push({ strength: wk.filter(isEffectiveStrength).length, mvpa });
  }
  const DOSE = Math.min(100, 50 * mean(weeks.map((w) => w.strength)));
  const lifts = Object.keys(EXERCISES).map((id) => {
    const ss = groupSessions(sets.filter((s) => s.exercise === id && !EXERCISES[id].bodyweight && (s.load ?? 0) > 0 && (s.reps ?? 0) <= 10 && daysBetween(s.date, today) <= 56));
    if (ss.length < 2) return null;
    const best = (sess) => Math.max(...sess.sets.map((s) => e1rm(s.load, s.reps, s.rir ?? 0)));
    const first = best(ss[0]), last = best(ss[ss.length - 1]);
    return { id, name: EXERCISES[id].name, first: round(first, 1), last: round(last, 1), pct: round((100 * (last - first)) / first, 1), trend: ss.map((x) => round(best(x), 1)) };
  }).filter(Boolean);
  const PROG = lifts.length ? mean(lifts.map((l) => 50 + 50 * clamp(l.pct / 5, -1, 1))) : null;
  const STR = PROG == null ? DOSE : 0.5 * DOSE + 0.5 * PROG;
  const CONS = 100 * mean(weeks.map((w) => 0.6 * Math.min(1, w.mvpa / 150) + 0.4 * Math.min(1, w.strength / 2))); // F12.7
  const parts = [[0.4, CRF], [0.3, STR], [0.3, CONS]].filter(([, v]) => v != null);
  const FS = sum(parts.map(([w, v]) => w * v)) / sum(parts.map(([w]) => w)); // F12.1
  const conf = vo2?.confidence === 'High' ? 'High' : vo2 ? 'Medium' : 'Low';
  return {
    FS: round(FS), CRF, STR: round(STR), CONS: round(CONS), DOSE: round(DOSE), PROG: PROG == null ? null : round(PROG),
    vo2, mets: vo2 ? round(vo2.value / 3.5, 1) : null, lifts, confidence: conf,
    weeks: weeks.reverse(),
  };
}

// F12.14 heart rate reserve zones
export function hrZones(profile, today, workouts, rhr) {
  const hm = hrMax(profile, today, workouts);
  const max = hm.value, rest = rhr || 60;
  const at = (p) => Math.round(rest + p * (max - rest));
  return {
    hrmax: round(max), rest: round(rest), observed: !!hm.observed,
    zones: [
      { z: 1, name: 'Light', from: at(0.3), to: at(0.39) },
      { z: 2, name: 'Moderate', from: at(0.4), to: at(0.59) },
      { z: 3, name: 'Zone 2 easy endurance', from: at(0.6), to: at(0.7) },
      { z: 4, name: 'Vigorous', from: at(0.71), to: at(0.89) },
      { z: 5, name: 'Max', from: at(0.9), to: round(max) },
    ],
  };
}

// F12.16 EWMA load, monotony and strain
export function loadMetrics(workouts, today, hrmaxV) {
  const daily = [];
  for (let i = 55; i >= 0; i--) {
    const d = addDays(today, -i);
    daily.push(sum(workouts.filter((w) => w.date === d).map((w) => sessionLoad(w, hrmaxV))));
  }
  const ewma = (N) => { const l = 2 / (N + 1); let L = 0; for (const x of daily) L = l * x + (1 - l) * L; return L; };
  const a = ewma(7), c = ewma(28);
  const last7 = daily.slice(-7);
  const mono = sd(last7) > 0 ? mean(last7) / sd(last7) : 0;
  const strain = sum(last7) * mono;
  const zoneMin = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const w of workouts.filter((x) => daysBetween(x.date, today) < 14 && x.zones)) for (const z in w.zones) zoneMin[z] += w.zones[z];
  const tot = sum(Object.values(zoneMin));
  const LIS = tot ? (zoneMin[1] + zoneMin[2]) / tot : null; // F12.15
  return { ewmaRatio: c ? round(a / c, 2) : 1, monotony: round(mono, 2), strain: round(strain), zoneMin, LIS: LIS == null ? null : round(LIS, 2), daily };
}

// F12.18 deload trigger when >= 2 signals fire
export function deloadSignals({ readinessHistory, nights, base, checkins, lifts, load }) {
  const r7 = readinessHistory.slice(-7).filter((x) => x != null);
  const sig = [
    { key: 'e1rm', label: 'Estimated max down 5%+ on 2 lifts', fired: lifts.filter((l) => l.pct <= -5).length >= 2 },
    { key: 'readiness', label: '7-day mean Readiness under 55', fired: r7.length >= 4 && mean(r7) < 55 },
    { key: 'hrv', label: 'HRV low on 5 of 7 days with resting HR up 5+', fired: (base?.lowHrvDays ?? 0) >= 5 && (base?.delta ?? 0) >= 5 },
    { key: 'monotony', label: 'Monotony over 2.0 with high strain', fired: load.monotony > 2 && load.strain > 3000 },
    { key: 'soreness', label: 'Soreness 4+ on 3 of 7 days', fired: checkins.slice(-7).filter((c) => c && c.soreness >= 4).length >= 3 },
  ];
  return { signals: sig, deload: sig.filter((s) => s.fired).length >= 2 };
}

export function buildPlan(goal = 'muscle', days = 3, minutes = 45, experience = 'intermediate') {
  const t = TEMPLATES[goal] || TEMPLATES.general;
  const split = SPLITS[Math.min(4, Math.max(2, days))] || SPLITS[3];
  const novice = experience === 'novice';
  const sets = novice ? 2 : Math.round((t.sets[0] + t.sets[1]) / 2);
  const reps = novice ? [8, 12] : t.reps;
  return {
    goal, days, minutes, experience, template: t.label,
    sessions: split.map(([name, ex]) => ({ name, exercises: ex.map((id) => ({ id, name: EXERCISES[id].name, sets, reps, rir: t.rir })) })),
    weeklySetsStart: goal === 'muscle' ? 10 : 6, // F12.11
    mesocycleWeeks: 4,
    proteinGPerKg: ['strength', 'muscle'].includes(goal) ? 1.6 : 1.2, // F12.21
  };
}
