// Energy (Formulas F10): one 5 to 100 gauge that falls through the day.
// Two-process model of sleep regulation (Borbely 2022), time constants from Skeldon et al.:
//   S_wake = S_bed x e^(-TST / 4.2)                    sleep pressure left at waking
//   S(t)   = 1 - (1 - S_wake) x e^(-t / 18.2)          t = hours awake
//   Energy = 100 (1 - S(t)) x (0.6 + 0.4 Recovery / 100) - stress drain - activity drain + rest
//   Stress drain: (Stress - 25) / 20 points an hour while Stress is above 25
//                 (the 9 AM reading until 3 PM, then the 3 PM reading).
//   Activity drain: (MET - 1) points an hour of workout (same METs as calories burned, F5a).
//   Rest: a reading at 25 or under adds 5 points (at most 10). Clamped to 5 to 100.
// S at bedtime is carried over from the day before (0.75 on the first day).
// Constants other than 18.2 and 4.2 are versioned starting values.
import { round, clamp, addDays } from './util.js';
import { MET } from './burn.js';

export const ENERGY_VERSION = 'F10 v1';
export const TAU_RISE = 18.2;
export const TAU_FALL = 4.2;

export function energyBand(e) {
  if (e == null) return null;
  if (e > 75) return { name: 'Charged', color: 'green' };
  if (e > 50) return { name: 'Good', color: 'teal' };
  if (e > 25) return { name: 'Getting low', color: 'amber' };
  return { name: 'Low', color: 'coral' };
}

const awakeHours = (wakeMin, bedMin) => (((bedMin - wakeMin) % 1440) + 1440) % 1440 / 60 || 16;

// Carry sleep pressure across nights. nights: [{date, tstH, bedEndMin}] sorted, up to and including `date`.
export function sleepPressure({ nights, date, wakeMin, bedMin, days = 21 }) {
  let S = 0.75;
  const from = addDays(date, -days);
  let wakeS = null, last = null;
  for (const n of nights.filter((x) => x.date > from && x.date <= date)) {
    const tst = n.tstH || 7;
    wakeS = S * Math.exp(-tst / TAU_FALL);
    last = n;
    const wm = n.bedEndMin ?? wakeMin;
    S = 1 - (1 - wakeS) * Math.exp(-awakeHours(wm, bedMin) / TAU_RISE);
  }
  if (!last || last.date !== date) return { S_wake: null, tstH: null };
  return { S_wake: round(wakeS, 3), tstH: last.tstH };
}

// Energy at minute m of the day, and the curve from waking to bedtime (hourly).
export function energyDay({ S_wake, recovery, wakeMin, bedMin, nowMin, stress, workouts = [] }) {
  if (S_wake == null) return null;
  const R = recovery ?? 60;
  const mult = 0.6 + 0.4 * (R / 100);
  const am = stress?.am?.value, pm = stress?.pm?.value;
  const rest = Math.min(10, (am != null && am <= 25 ? 5 : 0) + (pm != null && pm <= 25 ? 5 : 0));
  const stressAt = (m) => (m < 15 * 60 ? am : pm ?? am);
  const at = (m, upTo) => {
    const t = Math.max(0, (m - wakeMin) / 60);
    const S = 1 - (1 - S_wake) * Math.exp(-t / TAU_RISE);
    const base = 100 * (1 - S) * mult;
    // stress drain, hour by hour, only for time that has passed and is covered by a reading
    let sd = 0;
    const until = Math.min(m, upTo);
    for (let h = wakeMin; h < until; h += 15) {
      const s = stressAt(h + 7);
      if (s != null && s > 25) sd += ((s - 25) / 20) * 0.25;
    }
    let ad = 0;
    for (const w of workouts) {
      const start = w.startMin ?? 18 * 60;
      const end = start + (w.minutes || 0);
      if (start >= Math.min(m, upTo)) continue;
      const mins = Math.min(end, m, upTo) - start;
      const met = MET[w.type] ?? (w.strength ? MET.Strength : MET.Other);
      ad += (met - 1) * (mins / 60);
    }
    return { v: Math.round(clamp(base - sd - ad + (m > wakeMin + 60 ? rest : 0), 5, 100)), base: Math.round(base), stressDrain: round(sd, 1), activityDrain: round(ad, 1) };
  };
  const bedAbs = bedMin < wakeMin ? bedMin + 1440 : bedMin;
  const curve = [];
  for (let m = wakeMin; m <= bedAbs; m += 60) {
    const past = m <= nowMin;
    curve.push({ min: m % 1440, abs: m, v: at(m, past ? m : nowMin).v, projected: !past });
  }
  const now = at(Math.min(Math.max(nowMin, wakeMin), bedAbs), nowMin);
  const wake = at(wakeMin, wakeMin);
  // the last hour that stays above 50 on the projected curve: the best window for a hard session
  const good = curve.filter((p) => p.abs >= Math.max(nowMin, wakeMin) && p.v > 50);
  const goodUntilMin = good.length ? good[good.length - 1].min : null;
  return {
    version: ENERGY_VERSION, now: now.v, band: energyBand(now.v), atWake: wake.v, curve, goodUntilMin,
    parts: { sleepPressure: round(S_wake, 2), recovery: R, base: now.base, stressDrain: now.stressDrain, activityDrain: now.activityDrain, rest },
  };
}
