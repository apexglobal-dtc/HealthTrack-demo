// Weight loss v2 (Formulas F5 v2, "Stress, Energy and Weight Loss: research and proposal").
// Deterministic: the same weigh-ins and food logs always give the same numbers.
//
//  1. Trend weight      T_d = T_{d-1} + 0.1 (W_d - T_{d-1})   (gaps of g days use 1 - 0.9^g)
//  2. Learned TDEE      TDEE_obs = mean intake on complete days + rho * (T_start - T_end) / n
//                       rho = 4,860 kcal/kg up to week 4, rising linearly to 6,570 kcal/kg by week 24
//                       (CALERIE values reported by Thomas et al. 2014).
//                       Blend with the formula TDEE: k = min(0.8, complete days / 28);
//                       maintenance never moves more than 150 kcal in a week.
//  3. Projection        week by week: w_{k+1} = w_k - 7 (TDEE(w_k) - intake) / rho_k, TDEE recomputed at the
//                       new weight, so the curve flattens (Hall et al. 2011). Loss capped at 1% a week.
//  4. Protein           1.6 g/kg in a deficit (ISSN 2017: 1.4 to 2.0 g/kg for exercising people).
//  5. Plateau           trend moves < 0.2 kg in 21 days while >= 80% of days are fully logged.
import { round, addDays, daysBetween, clamp, mean } from './util.js';

export const WL_VERSION = 'F5 v2';
export const TREND_ALPHA = 0.1;
export const RHO_EARLY = 4860;
export const RHO_LATE = 6570;
export const PROTEIN_DEFICIT_G_PER_KG = 1.6;
export const WEEKLY_TDEE_STEP = 150;

// Energy in each kg lost, by week of the diet (1-based)
export function rhoForWeek(week) {
  if (week <= 4) return RHO_EARLY;
  if (week >= 24) return RHO_LATE;
  return round(RHO_EARLY + ((week - 4) / 20) * (RHO_LATE - RHO_EARLY));
}

// One trend value per weigh-in date. Input: [{date, kg}] in any order.
export function trendWeights(log) {
  const pts = [...(log || [])].filter((x) => x && x.kg).sort((a, b) => (a.date < b.date ? -1 : 1));
  const out = [];
  let T = null, last = null;
  for (const p of pts) {
    if (T == null) T = p.kg;
    else {
      const gap = Math.max(1, daysBetween(last, p.date));
      T = T + (1 - Math.pow(1 - TREND_ALPHA, gap)) * (p.kg - T);
    }
    last = p.date;
    out.push({ date: p.date, kg: p.kg, trend: round(T, 2) });
  }
  return out;
}

const trendOn = (trend, date) => {
  let v = null;
  for (const p of trend) { if (p.date <= date) v = p.trend; else break; }
  return v;
};

// Learned maintenance for one 28-day window ending on `end`.
// days: [{date, kcal, complete}] ; trend: output of trendWeights
export function observedTdee({ days, trend, end, weekOfDiet = 1 }) {
  const start = addDays(end, -27);
  const win = days.filter((d) => d.date >= start && d.date <= end);
  const complete = win.filter((d) => d.complete);
  const weighIns14 = trend.filter((p) => p.date > addDays(end, -14) && p.date <= end).length;
  const first = trend.find((p) => p.date >= start && p.date <= end);
  const Tend = trendOn(trend, end);
  if (complete.length < 10 || weighIns14 < 6 || !first || Tend == null) {
    return { ok: false, completeDays: complete.length, weighIns14, need: { completeDays: 10, weighIns14: 6 } };
  }
  const n = Math.max(7, daysBetween(first.date, end));
  const intake = mean(complete.map((d) => d.kcal));
  const rho = rhoForWeek(weekOfDiet);
  const lossKg = first.trend - Tend;
  const tdee = intake + (rho * lossKg) / n;
  return { ok: true, tdee: round(tdee), intake: round(intake), lossKg: round(lossKg, 2), days: n, rho, completeDays: complete.length, weighIns14 };
}

// Blend formula and observed maintenance, stepping week by week so it never jumps more than 150 kcal.
export function learnedMaintenance({ formulaTdee, days, log, today, dietStart = null }) {
  const trend = trendWeights(log);
  const weekOf = (d) => (dietStart ? Math.max(1, Math.floor(daysBetween(dietStart, d) / 7) + 1) : 1);
  let value = formulaTdee;
  const steps = [];
  for (let w = 3; w >= 0; w--) {
    const end = addDays(today, -1 - 7 * w);
    const obs = observedTdee({ days, trend, end, weekOfDiet: weekOf(end) });
    if (!obs.ok) { steps.push({ end, value: round(value), observed: null }); continue; }
    const k = Math.min(0.8, obs.completeDays / 28);
    const blended = (1 - k) * formulaTdee + k * obs.tdee;
    value = clamp(blended, value - WEEKLY_TDEE_STEP, value + WEEKLY_TDEE_STEP);
    steps.push({ end, value: round(value), observed: obs.tdee, k: round(k, 2) });
  }
  const latest = observedTdee({ days, trend, end: addDays(today, -1), weekOfDiet: weekOf(addDays(today, -1)) });
  const learned = latest.ok;
  return {
    version: WL_VERSION, learned, tdee: round(value), formulaTdee: round(formulaTdee),
    observed: latest.ok ? latest : null, missing: latest.ok ? null : latest,
    k: latest.ok ? round(Math.min(0.8, latest.completeDays / 28), 2) : 0, steps,
    trend, trendNow: trend.length ? trend[trend.length - 1].trend : null,
  };
}

// Week-by-week projection. tdeePerKg: how much maintenance falls per kg lost (about 10 kcal x activity factor,
// from the Mifflin-St Jeor weight term). adherence < 1 gives the slower edge of the range.
export function projectCurve({ weightKg, targetKg, intake, tdee, tdeePerKg, startWeek = 1, adherence = 1, maxWeeks = 156 }) {
  if (!weightKg || !intake || !tdee) return null;
  const pts = [{ week: 0, kg: round(weightKg, 1) }];
  let w = weightKg;
  let reached = null;
  for (let k = 0; k < maxWeeks; k++) {
    const tdeeW = tdee - tdeePerKg * (weightKg - w);
    const deficit = Math.max(0, (tdeeW - intake) * adherence);
    const loss = Math.min((7 * deficit) / rhoForWeek(startWeek + k), 0.01 * w);
    w -= loss;
    pts.push({ week: k + 1, kg: round(w, 2) });
    if (targetKg && reached == null && w <= targetKg) { reached = k + 1; break; }
    if (loss < 0.005) break; // flat: the new weight's maintenance has met the intake
  }
  const at = (wk) => pts.find((p) => p.week === wk)?.kg ?? pts[pts.length - 1].kg;
  return { points: pts, reachedWeek: reached, kg4: round(weightKg - at(4), 1), kg12: round(weightKg - at(12), 1), kg26: round(weightKg - at(26), 1), floorKg: round(pts[pts.length - 1].kg, 1) };
}

// Range for the goal date: on plan every day, or hitting 80% of the planned deficit.
export function projectionRange({ weightKg, targetKg, intake, tdee, AF, startWeek = 1, today }) {
  if (!weightKg || !targetKg || targetKg >= weightKg) return null;
  const tdeePerKg = 10 * (AF || 1.4);
  const fast = projectCurve({ weightKg, targetKg, intake, tdee, tdeePerKg, startWeek, adherence: 1 });
  const slow = projectCurve({ weightKg, targetKg, intake, tdee, tdeePerKg, startWeek, adherence: 0.8 });
  if (!fast) return null;
  const date = (wk) => (wk == null ? null : addDays(today, wk * 7));
  return {
    curve: fast.points, slowCurve: slow.points,
    weeksFast: fast.reachedWeek, weeksSlow: slow.reachedWeek,
    dateFast: date(fast.reachedWeek), dateSlow: date(slow.reachedWeek),
    reachable: fast.reachedWeek != null,
    flatAtKg: fast.reachedWeek == null ? fast.floorKg : null,
    firstMonthKg: fast.kg4,
  };
}

// Plateau: the trend barely moved in 21 days although the person logged most days.
export function plateauCheck({ trend, days, today, losing }) {
  if (!losing || trend.length < 2) return null;
  const end = addDays(today, -1), start = addDays(today, -21);
  const t0 = trendOn(trend, start), t1 = trendOn(trend, end);
  if (t0 == null || t1 == null) return null;
  const win = days.filter((d) => d.date >= start && d.date <= end);
  const logged = win.length ? win.filter((d) => d.complete).length / 21 : 0;
  const moved = round(t0 - t1, 2);
  if (moved < 0.2 && logged >= 0.8) return { plateau: true, movedKg: moved, loggedPct: Math.round(logged * 100) };
  return { plateau: false, movedKg: moved, loggedPct: Math.round(logged * 100) };
}
