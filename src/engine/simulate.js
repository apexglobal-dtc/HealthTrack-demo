// Simulated wearable data. Produces the same normalized records the real adapters
// (Open Wearables, Junction) produce, so engines cannot tell the difference.
// Deterministic: the same seed and date always give the same values.

import { rng, gauss, addDays, round, clamp, daysBetween, weekday } from './util.js';

export const DEVICE_CATALOG = [
  { id: 'apple_watch', name: 'Apple Watch', kind: 'watch', stages: true, hrv: 'sdnn', temp: true, vo2: true },
  { id: 'oura', name: 'Oura Ring', kind: 'ring', stages: true, hrv: 'rmssd', temp: true, vo2: false },
  { id: 'garmin', name: 'Garmin', kind: 'watch', stages: true, hrv: 'rmssd', temp: false, vo2: true },
  { id: 'whoop', name: 'WHOOP', kind: 'band', stages: true, hrv: 'rmssd', temp: true, vo2: false, noSteps: true },
  { id: 'fitbit', name: 'Fitbit (Google Health)', kind: 'band', stages: true, hrv: 'rmssd', temp: true, vo2: true },
  { id: 'samsung', name: 'Samsung Galaxy Watch', kind: 'watch', stages: true, hrv: 'rmssd', temp: true, vo2: true },
  { id: 'pixel', name: 'Google Pixel Watch', kind: 'watch', stages: true, hrv: 'rmssd', temp: true, vo2: true },
  { id: 'polar', name: 'Polar', kind: 'watch', stages: true, hrv: 'rmssd', temp: false, vo2: true },
  { id: 'coros', name: 'COROS', kind: 'watch', stages: true, hrv: 'rmssd', temp: false, vo2: true },
  { id: 'withings', name: 'Withings', kind: 'watch', stages: true, hrv: 'rmssd', temp: false, vo2: false },
  { id: 'ultrahuman', name: 'Ultrahuman Ring', kind: 'ring', stages: true, hrv: 'rmssd', temp: true, vo2: false },
  { id: 'amazfit', name: 'Amazfit', kind: 'watch', stages: true, hrv: 'rmssd', temp: false, vo2: true },
  { id: 'eight_sleep', name: 'Eight Sleep', kind: 'bed', stages: true, hrv: 'rmssd', temp: false, vo2: false, noSteps: true },
  { id: 'phone', name: 'This phone (motion and screen use)', kind: 'phone', stages: false, hrv: null, temp: false, vo2: false },
];

export const deviceById = (id) => DEVICE_CATALOG.find((d) => d.id === id);

function personal(seed) {
  const r = rng(seed + ':traits');
  return {
    hrv: 38 + r() * 30, // ms
    rhr: 54 + r() * 10,
    sleep: 6.7 + r() * 0.9,
    bed: 23 * 60 + (r() - 0.4) * 70,
    steps: 6500 + r() * 4000,
    vo2: 31 + r() * 10,
    hrmax: 182 + r() * 12,
  };
}

// Cycle phase helper for simulated physiology (female personas with cycle on)
export function simulatedPeriods(seed, today, n = 5) {
  const r = rng(seed + ':cycle');
  const periods = [];
  let start = addDays(today, -Math.round(4 + r() * 20));
  for (let i = 0; i < n; i++) {
    const len = 5 + Math.round(r() * 1);
    periods.unshift({ start, end: addDays(start, len - 1) });
    start = addDays(start, -Math.round(27 + r() * 4));
  }
  return periods;
}

function lutealOn(periods, date) {
  const p = periods.filter((x) => x.start <= date).slice(-1)[0];
  if (!p) return false;
  const cd = daysBetween(p.start, date) + 1;
  return cd >= 16;
}

export function simulateRange({ seed, device, from, to, periods = null }) {
  const dev = deviceById(device) || deviceById('oura');
  const t = personal(seed);
  const nights = [], steps = [], workouts = [];
  let ar = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = rng(`${seed}:${device}:${d}`);
    ar = 0.6 * ar + 0.4 * gauss(r);
    const dow = weekday(d);
    const weekend = dow === 0 || dow === 6;
    const luteal = periods ? lutealOn(periods, d) : false;
    // sleep (night ending on date d)
    const short = r() < 0.12;
    let tst = t.sleep + (weekend ? 0.6 : 0) + 0.45 * gauss(r) - (short ? 1.1 : 0);
    tst = clamp(tst, 4.2, 9.6);
    const eff = clamp(0.88 + 0.04 * gauss(r) - (short ? 0.03 : 0), 0.74, 0.98);
    const inBed = tst / eff;
    const bedStart = t.bed + (weekend ? 45 : 0) + 25 * gauss(r) + (short ? 50 : 0);
    const bedEnd = bedStart + inBed * 60;
    const mid = (bedStart + bedEnd) / 2;
    let hrv = t.hrv * Math.exp(0.12 * ar - (short ? 0.12 : 0) - (luteal ? 0.07 : 0));
    let rhr = t.rhr + 1.6 * -ar + (short ? 2 : 0) + (luteal ? 2.3 : 0) + 0.8 * gauss(r);
    if (dev.hrv === 'sdnn') hrv *= 1.15;
    const night = {
      date: d, bedStartMin: round(((bedStart % 1440) + 1440) % 1440), bedEndMin: round(bedEnd % 1440),
      midMin: round(((mid % 1440) + 1440) % 1440), tstH: round(tst, 2), eff: round(eff, 3), stages: dev.stages,
      deepH: round(tst * 0.18, 2), remH: round(tst * 0.22, 2), lightH: round(tst * 0.6, 2), awakeH: round(inBed - tst, 2),
      source: device, simulated: true,
    };
    if (dev.hrv) { night.hrv = round(hrv, 1); night.hrvMethod = dev.hrv; night.rhr = round(rhr, 1); night.respRate = round(14 + gauss(r) * 0.6, 1); }
    if (dev.temp) night.skinTempDev = round((luteal ? 0.32 : -0.05) + 0.08 * gauss(r), 2);
    if (dev.vo2 && dow === 1) night.vo2max = round(t.vo2 + 0.6 * gauss(r), 1);
    if (dev.kind === 'phone') { delete night.eff; night.stages = false; night.estimate = true; }
    nights.push(night);
    // steps for the day d
    if (!dev.noSteps) steps.push({ date: d, steps: Math.max(1200, Math.round(t.steps * (weekend ? 0.85 : 1) + 1800 * gauss(r))), source: device, simulated: true });
    // device-recorded cardio: Tue/Thu/Sat runs or rides
    if (dev.kind !== 'phone' && dev.kind !== 'bed' && [2, 4, 6].includes(dow) && r() < 0.8) {
      const minutes = Math.round(28 + r() * 25);
      const easy = dow !== 4;
      const z = easy ? { 1: 4, 2: Math.round(minutes * 0.7), 3: Math.round(minutes * 0.25), 4: 0, 5: 0 } : { 1: 3, 2: Math.round(minutes * 0.3), 3: Math.round(minutes * 0.3), 4: Math.round(minutes * 0.3), 5: 2 };
      workouts.push({
        id: `w_${device}_${d}`, date: d, startMin: 7 * 60 + Math.round(r() * 60), type: dow === 6 ? 'Cycling' : 'Running',
        minutes, distanceKm: round(minutes / (dow === 6 ? 2.6 : 6.2), 1), avgHr: Math.round(t.hrmax * (easy ? 0.7 : 0.8)),
        maxHr: Math.round(t.hrmax * (easy ? 0.82 : 0.93)), zones: z, strength: false, source: device, simulated: true,
      });
    }
  }
  return { nights, steps, workouts };
}

// Seed in-app history so Progress, habits and strength trends have something to show.
export function simulateStrengthHistory({ seed, from, to, scale = 1 }) {
  const r = rng(seed + ':lifts');
  const raw = { bench: 50 + r() * 30, row: 45 + r() * 25, ohp: 30 + r() * 15, squat: 70 + r() * 40, rdl: 70 + r() * 30, lunge: 16 + r() * 10, goblet: 22 + r() * 10, pulldown: 45 + r() * 20, pushup: 0 };
  const base = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v * scale]));
  // matches the 3-day split in fitness.js: Upper (Mon), Lower (Wed), Full body (Fri)
  const plan = { 1: ['bench', 'row', 'ohp'], 3: ['squat', 'rdl', 'lunge'], 5: ['goblet', 'pushup', 'pulldown'] };
  const sets = [], workouts = [];
  let wk = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = weekday(d);
    if (dow === 1) wk++;
    if (!plan[dow] || d === to) continue;
    if (r() < 0.12) continue; // a missed session now and then
    const ex = plan[dow];
    let n = 0;
    for (const id of ex) {
      const load = base[id] ? Math.max(2.5, Math.round((base[id] * (1 + 0.012 * wk)) / 2.5) * 2.5) : 0;
      for (let s = 0; s < 3; s++) {
        sets.push({ id: `s_${d}_${id}_${s}`, date: d, exercise: id, load, reps: 8 + (s === 2 ? Math.round(r() * 3) : 1), rir: s === 2 ? 1 : 2, source: 'healthtrack' });
        n++;
      }
    }
    workouts.push({ id: `ws_${d}`, date: d, startMin: 18 * 60, type: 'Strength', minutes: 45 + Math.round(r() * 10), rpe: 7, strength: true, workingSets: n, muscleGroups: ex.includes('squat') ? ['quads', 'glutes', 'hamstrings'] : ex.includes('goblet') ? ['quads', 'glutes', 'chest', 'back'] : ['chest', 'back', 'shoulders'], source: 'healthtrack', simulated: true });
  }
  return { sets, workouts };
}
