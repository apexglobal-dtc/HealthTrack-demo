// Stress (Formulas F9): two readings a day, at 9 AM (waking to 9 AM) and 3 PM (9 AM to 3 PM).
// Only still, awake 5-minute stretches count (fewer than 50 steps, not within 10 minutes after a workout);
// the wearable adapter hands those stretches over as { hr, hrv? }.
//
//   HR part  = clamp((HR - RHR_base) / (0.30 (HR_max - RHR_base)), 0, 1)
//   z        = (ln HRV - daytime mean of ln HRV) / daytime SD of ln HRV      (own 30-day baseline)
//   HRV part = clamp(-z / 2, 0, 1)
//   Stress   = 100 (0.6 HRV part + 0.4 HR part); heart rate only: 80 x HR part (lower confidence)
//   A reading needs 30 minutes of still data (6 stretches) and 14 days of baseline; otherwise it is skipped.
//   No wearable: the check-in answer (1 to 5) gives (answer - 1) x 25.
// Method follows Firstbeat (HR up and HRV below the person's own resting level, activity removed) and
// Shaffer and Ginsberg 2017 (5-minute RMSSD windows). Constants are versioned starting values.
import { round, clamp, mean, addDays } from './util.js';

export const STRESS_VERSION = 'F9 v1';
export const READINGS = [
  { id: 'am', label: '9 AM', atMin: 9 * 60, covers: 'waking to 9 AM' },
  { id: 'pm', label: '3 PM', atMin: 15 * 60, covers: '9 AM to 3 PM' },
];
export const MIN_STRETCHES = 6; // 6 x 5 minutes = 30 minutes still
export const BASELINE_DAYS = 14;

export function stressBand(s) {
  if (s == null) return null;
  if (s <= 25) return { name: 'Resting', color: 'green' };
  if (s <= 50) return { name: 'Low', color: 'teal' };
  if (s <= 75) return { name: 'Medium', color: 'amber' };
  return { name: 'High', color: 'coral' };
}

// daytime: [{date, am:[stretches], pm:[stretches]}] ; nights: [{date, rhr}]
export function stressBaseline({ daytime, nights, date }) {
  const from = addDays(date, -30);
  const rhr = nights.filter((n) => n.date >= from && n.date < date && n.rhr).map((n) => n.rhr);
  const days = daytime.filter((d) => d.date >= from && d.date < date);
  const ln = [];
  for (const d of days) for (const w of ['am', 'pm']) for (const s of d[w] || []) if (s.hrv) ln.push(Math.log(s.hrv));
  const mu = ln.length ? mean(ln) : null;
  const sd = ln.length > 4 ? Math.sqrt(mean(ln.map((x) => (x - mu) ** 2))) : null;
  return {
    days: days.length, active: days.length >= BASELINE_DAYS && rhr.length >= 7,
    rhr: rhr.length ? round(mean(rhr), 1) : null, lnMean: mu, lnSd: sd && sd > 0.05 ? sd : sd ? 0.05 : null, hrvReadings: ln.length,
  };
}

export function scoreStretch(s, base, hrMax) {
  const hrPart = clamp((s.hr - base.rhr) / (0.3 * (hrMax - base.rhr)), 0, 1);
  if (s.hrv && base.lnMean != null && base.lnSd) {
    const z = (Math.log(s.hrv) - base.lnMean) / base.lnSd;
    const hrvPart = clamp(-z / 2, 0, 1);
    return { stress: 100 * (0.6 * hrvPart + 0.4 * hrPart), hrv: true };
  }
  return { stress: 80 * hrPart, hrv: false };
}

export function stressReading(stretches, base, hrMax) {
  const s = stretches || [];
  if (!base.active || s.length < MIN_STRETCHES) return { value: null, skipped: true, stillMin: s.length * 5, reason: !base.active ? 'baseline' : 'not enough still time' };
  const scored = s.map((x) => scoreStretch(x, base, hrMax));
  const value = Math.round(mean(scored.map((x) => x.stress)));
  const withHrv = scored.filter((x) => x.hrv).length;
  return { value, band: stressBand(value), stillMin: s.length * 5, hrvStretches: withHrv, method: withHrv ? 'hr+hrv' : 'hr', confidence: withHrv ? 'High' : 'Medium' };
}

// Both readings for one date. nowMin limits today to the readings that have happened.
export function stressDay({ date, daytime, base, hrMax, checkin, isToday, nowMin }) {
  const d = daytime?.find((x) => x.date === date);
  const out = {};
  for (const r of READINGS) {
    const due = !isToday || nowMin >= r.atMin;
    if (!due) { out[r.id] = { value: null, pending: true, at: r.label }; continue; }
    let rd = d ? stressReading(d[r.id], base, hrMax) : { value: null, skipped: true };
    if (rd.value == null && checkin?.stress != null) {
      const v = (checkin.stress - 1) * 25;
      rd = { value: v, band: stressBand(v), method: 'check-in', confidence: 'Low' };
    }
    out[r.id] = { ...rd, at: r.label, covers: r.covers };
  }
  const vals = [out.am.value, out.pm.value].filter((v) => v != null);
  const day = vals.length ? Math.round(mean(vals)) : null;
  return { date, am: out.am, pm: out.pm, day, band: stressBand(day) };
}

// Trend alert: high stress (day average above 75) three days running.
export function stressAlert(series) {
  const last3 = series.slice(-3);
  if (last3.length === 3 && last3.every((d) => d.day != null && d.day > 75)) return { key: 'stress_3', text: 'Stress has been high three days running.' };
  return null;
}
