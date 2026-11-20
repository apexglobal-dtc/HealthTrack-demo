// Menstrual cycle module: formulas F8.1 to F8.15 (PRD v4 section 6.4).
// Context, not a score: it never lowers the Wellness Status.

import { clamp, round, median, mean, sd, addDays, daysBetween, sum } from './util.js';

export const SYMPTOMS = [
  { key: 'cramps', label: 'Cramps' },
  { key: 'headache', label: 'Headache' },
  { key: 'bloating', label: 'Bloating' },
  { key: 'breast', label: 'Breast tenderness' },
  { key: 'mood', label: 'Low mood' },
  { key: 'fatigue', label: 'Fatigue' },
];
export const FLOWS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy'];

export function cycleLengths(periods) {
  const starts = periods.map((p) => p.start).sort();
  const L = [];
  for (let k = 0; k + 1 < starts.length; k++) {
    const len = daysBetween(starts[k], starts[k + 1]);
    L.push({ start: starts[k], len, valid: len >= 15 && len <= 90 }); // F8.2
  }
  return L;
}

export function predict(cycle, today) {
  const periods = (cycle.periods || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!periods.length) return null;
  const last = periods[periods.length - 1];
  const lens = cycleLengths(periods).filter((l) => l.valid).slice(-6).map((l) => l.len);
  const Lhat = lens.length >= 2 ? median(lens) : cycle.typicalLength || 29; // F8.3
  const s = Math.max(2, lens.length >= 2 ? sd(lens) : 0); // F8.4
  let next = addDays(last.start, Math.round(Lhat));
  const conf = lens.length >= 3 && sd(lens) <= 3 ? 'High' : lens.length >= 2 && sd(lens) <= 7 ? 'Medium' : 'Low'; // F8.5
  const CD = daysBetween(last.start, today) + 1; // F8.1
  const O = Math.round(Lhat) - 12; // F8.6
  return {
    CD, Lhat: round(Lhat, 1), s: round(s), next, windowFrom: addDays(next, -Math.round(s)), windowTo: addDays(next, Math.round(s)),
    confidence: conf, O, lastStart: last.start, lastEnd: last.end, cycles: lens.length, lens,
  };
}

// F8.7 temperature shift: tau_k, tau_k+1, tau_k+2 each >= mean(prev 6) + 0.2 C
export function temperatureShift(nights, fromDate) {
  const t = nights.filter((n) => n.date >= fromDate && n.skinTempDev != null);
  for (let k = 6; k + 2 < t.length; k++) {
    const m = mean(t.slice(k - 6, k).map((n) => n.skinTempDev));
    if ([0, 1, 2].every((j) => t[k + j].skinTempDev >= m + 0.2)) return t[k].date;
  }
  return null;
}

export function phaseOn(pred, cycle, nights, date) {
  if (!pred) return null;
  const bleeding = (cycle.flow?.[date] ?? 0) >= 1 || (pred.lastEnd && date >= pred.lastStart && date <= pred.lastEnd);
  if (bleeding) return { phase: 'Menstrual', label: 'confirmed' };
  const CD = daysBetween(pred.lastStart, date) + 1;
  if (date > pred.windowTo) return { phase: 'Late', label: 'estimated' };
  const shift = temperatureShift(nights, pred.lastStart);
  if (shift && date >= shift) return { phase: 'Luteal', label: 'confirmed' }; // F8.8
  if (CD >= pred.O + 1) return { phase: 'Luteal', label: 'estimated' };
  return { phase: 'Follicular', label: 'estimated' };
}

// F8.9 personal luteal shift after >= 2 cycles with >= 5 valid nights per phase
export function lutealShift(cycle, nights) {
  const periods = (cycle.periods || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  if (periods.length < 3) return null;
  const F = [], L = [];
  for (let k = 0; k + 1 < periods.length; k++) {
    const len = daysBetween(periods[k].start, periods[k + 1].start);
    const O = len - 12;
    for (const n of nights) {
      const cd = daysBetween(periods[k].start, n.date) + 1;
      if (cd < 1 || cd > len) continue;
      if (cd > 5 && cd < O) F.push(n);
      else if (cd > O) L.push(n);
    }
  }
  if (F.length < 5 || L.length < 5) return null;
  const rhrF = mean(F.filter((n) => n.rhr).map((n) => n.rhr));
  const rhrL = mean(L.filter((n) => n.rhr).map((n) => n.rhr));
  const hF = mean(F.filter((n) => n.hrv).map((n) => Math.log(n.hrv)));
  const hL = mean(L.filter((n) => n.hrv).map((n) => Math.log(n.hrv)));
  return { dRhr: round(clamp(rhrL - rhrF, 0, 5), 2), dh: round(clamp(hL - hF, -0.3, 0), 3) };
}

export function symptomBurden(sym) {
  if (!sym) return 0;
  const vals = SYMPTOMS.map((s) => sym[s.key] || 0);
  return round((100 * sum(vals)) / (3 * vals.length)); // F8.11
}

export function notices(cycle, pred, today, isTeen) {
  // F8.14 wellness notices; neutral copy, no condition named.
  const out = [];
  if (!pred || ['hormonal', 'pregnant', 'menopause'].includes(cycle.lifeStage)) return out;
  const msg = 'This may be worth discussing with a healthcare professional.';
  if (daysBetween(pred.lastStart, today) >= 90) out.push(`No period logged for 90 days or more. ${msg}`);
  const lens = pred.lens;
  if (lens.length >= 3) {
    const m = median(lens.slice(-3));
    if ((isTeen ? m < 21 || m > 45 : m < 24 || m > 38)) out.push(`Your recent cycles are outside the usual length range. ${msg}`);
    if (Math.max(...lens) - Math.min(...lens) > 9) out.push(`Your cycle lengths vary by more than 9 days. ${msg}`);
  }
  if (pred.lastEnd && daysBetween(pred.lastStart, pred.lastEnd) + 1 > 8) out.push(`Your last period lasted more than 8 days. ${msg}`);
  return out;
}

export function cycleContext(cycle, nights, today, isTeen = false) {
  if (!cycle?.enabled) return { enabled: false };
  const stage = cycle.lifeStage || 'none';
  if (stage === 'hormonal' || stage === 'menopause') {
    // F8.15: bleeding only or symptoms only, no phase estimate or adjustment
    return { enabled: true, stage, pred: null, phase: null, SB: symptomBurden(cycle.symptoms?.[today]), adj: null, notices: [] };
  }
  if (stage === 'pregnant') return { enabled: true, stage, paused: true, pred: null, phase: null, SB: 0, adj: null, notices: [] };
  const pred = predict(cycle, today);
  const ph = phaseOn(pred, cycle, nights, today);
  const shift = lutealShift(cycle, nights);
  const adj = ph?.phase === 'Luteal' && shift ? shift : null; // F8.10
  const heavyDays = Object.entries(cycle.flow || {}).filter(([d, f]) => f >= 4 && pred && d >= pred.lastStart).length;
  return {
    enabled: true, stage, pred, phase: ph, shift, adj, learned: !!shift,
    SB: symptomBurden(cycle.symptoms?.[today]),
    heavyFlow: heavyDays >= 2, // F8.13
    notices: notices(cycle, pred, today, isTeen),
    wider: stage === 'perimenopause',
  };
}
