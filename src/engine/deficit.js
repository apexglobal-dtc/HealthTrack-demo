// Calorie deficit (Formulas F5.1 to F5.3 and White Paper "Energy"):
//   BMR  = Mifflin-St Jeor resting energy (F5.1)
//   TDEE = BMR x activity factor from the last 14 days of steps and exercise (F5.2), i.e. maintenance calories
//   Target = TDEE x (1 - pace), pace at most 20%, never below 1,200 kcal (women) or 1,500 kcal (men)
//   Expected loss also capped at 1% of body weight a week.
//   About 7,700 kcal of deficit is roughly 1 kg of body weight (a rule of thumb; real loss slows over time).
// Deficits are switched off for an eating-disorder screen, pregnancy, under-18s and after giving birth (PRD safety switches).
import { round, addDays } from './util.js';

export const KCAL_PER_KG = 7700;
export const MAX_PCT = 0.2;
export const PACES = {
  gentle: { id: 'gentle', label: 'Gentle', pct: 0.1, note: 'Easiest to keep up' },
  steady: { id: 'steady', label: 'Steady', pct: 0.15, note: 'A good balance' },
  faster: { id: 'faster', label: 'Faster', pct: 0.2, note: 'The most we allow' },
};

export function calorieFloor(sex) { return sex === 'male' ? 1500 : 1200; }

export function deficitSafety({ profile, age, lifeStage }) {
  if (profile.edFlag || profile.edScreenPassed === false) return { hidden: true, reason: 'Calorie targets are turned off for your account to keep the focus on regular, enough eating.' };
  if (profile.pregnant) return { paused: true, reason: 'Calorie deficits are paused during pregnancy. Your target is set to maintenance.' };
  if (age < 18) return { paused: true, reason: 'Calorie deficits are not offered under 18. Your target is set to maintenance.' };
  if (lifeStage === 'postpartum') return { paused: true, reason: 'Calorie deficits are paused after giving birth and while breastfeeding. Your target is set to maintenance.' };
  return null;
}

export function deficitPlan({ REE, AF, sex, weightKg, pace }) {
  const tdee = REE * AF;
  const floor = calorieFloor(sex);
  const pct = Math.min(MAX_PCT, PACES[pace]?.pct ?? PACES.gentle.pct);
  let target = tdee * (1 - pct);
  let limitedBy = null;
  if (weightKg) {
    const capDaily = (0.01 * weightKg * KCAL_PER_KG) / 7; // at most 1% of body weight a week
    if (tdee - target > capDaily) { target = tdee - capDaily; limitedBy = 'pace'; }
  }
  if (target < floor) { target = floor; limitedBy = 'floor'; }
  const daily = Math.max(0, tdee - target);
  return {
    bmr: round(REE), AF: round(AF, 3), tdee: round(tdee), pct, target: round(target), daily: round(daily), floor, limitedBy,
    weeklyKg: round((daily * 7) / KCAL_PER_KG, 2),
  };
}

// Deficit for one day, given what was eaten (a range, because photo portions are estimates)
export function dayDeficit({ tdee, kcalLow, kcalHigh }) {
  return { low: round(tdee - kcalHigh), high: round(tdee - kcalLow), mid: round(tdee - (kcalLow + kcalHigh) / 2) };
}

// Sum over fully logged days only: a half-logged day would look like a huge deficit
export function weekSummary(days) {
  const full = days.filter((d) => d.complete);
  const total = full.reduce((a, d) => a + (d.tdee - d.kcal), 0);
  return { loggedDays: full.length, totalDeficit: round(total), estKg: round(total / KCAL_PER_KG, 2), avgDaily: full.length ? round(total / full.length) : null };
}

export function projection({ weightKg, targetKg, daily, today }) {
  if (!weightKg || !targetKg || targetKg >= weightKg || !daily) return null;
  const weeks = ((weightKg - targetKg) * KCAL_PER_KG) / (daily * 7);
  return { weeks: Math.ceil(weeks), date: addDays(today, Math.ceil(weeks * 7)), kg: round(weightKg - targetKg, 1) };
}
