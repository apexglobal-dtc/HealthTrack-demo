// Shared math and date helpers used by every engine module.
// Notation follows the Formulas and Algorithms document (v4.2-draft).

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// round(x) rounds half up; round(x, -2) rounds to the nearest 100.
export function round(x, digits = 0) {
  const f = Math.pow(10, digits);
  return Math.floor(x * f + 0.5) / f;
}

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs) => (xs.length ? sum(xs) / xs.length : null);

export function median(xs) {
  const v = xs.filter((x) => x != null && !Number.isNaN(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function mad(xs) {
  const m = median(xs);
  if (m == null) return null;
  return median(xs.map((x) => Math.abs(x - m)));
}

export function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

// ---------- dates (all local calendar dates as 'YYYY-MM-DD') ----------
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export function weekday(s) {
  return parseDate(s).getDay(); // 0 = Sunday
}

// minutes after midnight <-> 'HH:MM'
export function minToClock(m) {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}
export function clockToMin(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function fmtHours(h) {
  if (h == null) return '--';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1} h 0 m` : `${hh} h ${mm} m`;
}

// Circular mean of clock minutes (handles midnight wrap-around, F2.4).
export function circularMeanMin(mins) {
  if (!mins.length) return null;
  let s = 0, c = 0;
  for (const m of mins) {
    const a = (m / 1440) * 2 * Math.PI;
    s += Math.sin(a);
    c += Math.cos(a);
  }
  let a = Math.atan2(s / mins.length, c / mins.length);
  if (a < 0) a += 2 * Math.PI;
  return (a / (2 * Math.PI)) * 1440;
}
export function circularDiffMin(a, b) {
  const d = Math.abs(a - b) % 1440;
  return d > 720 ? 1440 - d : d;
}

// ---------- deterministic randomness for simulated data ----------
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(r) {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function ageFrom(dob, today) {
  if (!dob) return 35;
  const b = parseDate(dob);
  const t = parseDate(today);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}
