// Health Track Pro: one platform for the professionals a member chooses to share with.
// The same core (consent, member list with alerts, member detail, plan settings, notes, messages)
// is reused for each audience, with different data, alerts and actions for each use case.
//
//   dietitian  HT 1.0  Plus + Dietitian (live in the demo, see rd.js)
//   coach      HT 2.0  B2B: sports clubs, schools and colleges, personal coaches
//   employer   HT 2.0  B2B: corporate wellness programs (group totals only, never one person's data)
//   provider   HT 3.0  Provider network: clinics and physicians

const round = (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; };

// What a member can share. Each professional asks for some of these; the member can turn any of them off.
export const SHARE = {
  food: { label: 'Food logs and meal plan', icon: 'leaf' },
  body: { label: 'Weight and body measurements', icon: 'ruler' },
  activity: { label: 'Sleep, activity, readiness and workouts', icon: 'pulse' },
  labs: { label: 'Lab results', icon: 'file' },
  cycle: { label: 'Cycle tracking', icon: 'calendar' },
};

export const PRO_ROLES = {
  dietitian: {
    id: 'dietitian', label: 'Registered dietitian', product: 'Health Track 1.0', tier: 'Plus + Dietitian', status: 'live',
    person: { name: 'Dana Lee', credentials: 'RDN, LD', initials: 'DL', org: 'Health Track Dietitian Network' },
    email: 'dana.lee@pro.myhealthtrack.ai', code: 'RD-DANA', route: 'rd', icon: 'leaf', color: 'var(--green)', tint: 'var(--tint-green)',
    asks: ['food', 'body', 'activity', 'labs'], never: ['cycle details unless shared', 'Health Genie chats', 'location'],
    pitch: 'One-to-one nutrition care between visits: the dietitian sets the plan, the app carries it out every day.',
    actions: ['Set protein, calorie floor, pace and recipes to avoid', 'Private visit notes', 'Two-way messages'],
    alerts: ['Low food logging', 'Losing weight too fast', 'Protein or fiber low', 'Eating below the calorie floor', 'Labs outside the optimal range'],
  },
  coach: {
    id: 'coach', label: 'Sports coach', product: 'Health Track 2.0', tier: 'Teams and clubs', status: 'preview',
    person: { name: 'Alex Rivera', credentials: 'CSCS', initials: 'AR', org: 'Riverside FC Academy, U19' },
    email: 'alex.rivera@riversidefc.example', code: 'COACH-2048', route: 'pro-coach', icon: 'dumbbell', color: 'var(--teal)', tint: 'var(--tint-teal)',
    asks: ['activity'], never: ['food logs unless shared', 'weight unless shared', 'labs', 'cycle details (only "available" or "modify")', 'Health Genie chats'],
    pitch: 'Fewer injuries and better sessions: the coach sees who is ready, who is overloaded and who slept badly, before training starts.',
    actions: ['Set each athlete\'s next session (Push, As planned, Lighter, Rest)', 'Team announcements', 'Notes per athlete'],
    alerts: ['Training load rising too fast (ACWR over 1.5)', 'Low readiness', 'Short sleep', 'Missed check-ins'],
  },
  employer: {
    id: 'employer', label: 'Corporate wellness lead', product: 'Health Track 2.0', tier: 'Corporate wellness', status: 'preview',
    person: { name: 'Morgan Chen', credentials: 'Wellbeing lead', initials: 'MC', org: 'Northwind Logistics' },
    email: 'morgan.chen@northwind.example', code: 'NORTHWIND', route: 'pro-employer', icon: 'users', color: 'var(--violet)', tint: 'var(--tint-violet)',
    asks: ['activity'], groupOnly: true, minGroup: 10,
    never: ['any one person\'s data', 'names next to any health number', 'food, weight, labs or cycle', 'groups smaller than 10 people'],
    pitch: 'A healthier workforce the employer can measure without ever seeing one person\'s health data.',
    actions: ['Launch team challenges', 'Program announcements', 'Benefits and resources'],
    alerts: ['Sleep falling across a department', 'Stress rising during busy weeks', 'Engagement dropping'],
  },
  provider: {
    id: 'provider', label: 'Healthcare provider', product: 'Health Track 3.0', tier: 'Provider network', status: 'preview',
    person: { name: 'Dr. Sam Patel', credentials: 'MD, Internal Medicine', initials: 'SP', org: 'Lakeside Family Clinic' },
    email: 's.patel@lakesideclinic.example', code: 'CLINIC-7731', route: 'pro-provider', icon: 'heart', color: 'var(--coral)', tint: 'var(--tint-coral)',
    asks: ['body', 'activity', 'labs'], never: ['food photos unless shared', 'Health Genie chats', 'cycle details unless shared'],
    pitch: 'The months between appointments, summarised: trends, care gaps and lab changes, with a one-tap referral to a dietitian.',
    actions: ['Care-plan notes', 'Order follow-up labs (demo)', 'Refer to a Health Track dietitian', 'Visit summary for the record'],
    alerts: ['Lab value rising (HbA1c, LDL)', 'Lab follow-up overdue', 'Resting heart rate trending up', 'Unplanned weight change'],
  },
};

export const roleByCode = (code) => Object.values(PRO_ROLES).find((r) => r.code.toLowerCase() === String(code || '').trim().toLowerCase()) || null;

export function cleanShare(role, share = {}) {
  const r = PRO_ROLES[role];
  const out = {};
  for (const k of Object.keys(SHARE)) out[k] = !!share[k] && (r.asks.includes(k) || (k === 'cycle' && !r.groupOnly));
  return out;
}
export const defaultShare = (role) => Object.fromEntries(Object.keys(SHARE).map((k) => [k, PRO_ROLES[role].asks.includes(k)]));

// ---------------- coach ----------------
export const SESSIONS = { push: 'Push', planned: 'As planned', lighter: 'Lighter', rest: 'Rest' };

export function coachAlerts(a) {
  const out = [];
  if (a.acwr != null && a.acwr > 1.5) out.push({ level: 'warn', key: 'load', text: `Training load up fast (ACWR ${a.acwr})` });
  if (a.readiness != null && a.readiness < 50) out.push({ level: 'warn', key: 'ready', text: `Readiness ${a.readiness}, recover today` });
  else if (a.readiness != null && a.readiness < 60) out.push({ level: 'info', key: 'ready', text: `Readiness ${a.readiness}, keep it light` });
  if (a.sleepH != null && a.sleepH < 7) out.push({ level: 'info', key: 'sleep', text: `Slept ${a.sleepH} h last night` });
  if (a.checkins7 != null && a.checkins7 < 4) out.push({ level: 'info', key: 'checkin', text: `Checked in ${a.checkins7} of 7 days` });
  if (a.availability === 'modify') out.push({ level: 'info', key: 'avail', text: 'Asked for a modified session' });
  return out;
}
export function suggestSession(a) {
  if (a.readiness != null && a.readiness < 50) return 'rest';
  if ((a.acwr != null && a.acwr > 1.5) || (a.readiness != null && a.readiness < 60) || a.availability === 'modify') return 'lighter';
  if (a.readiness != null && a.readiness >= 75 && (a.acwr == null || a.acwr <= 1.3)) return 'push';
  return 'planned';
}

function wave(i, seed, amp) { return Math.sin(i * 1.7 + seed) * amp; }
export function sampleAthletes() {
  const base = [
    { id: 'a_kai', name: 'Kai Thompson', position: 'Forward', age: 18, readiness: 82, sleepH: 8.1, acwr: 1.12, checkins7: 7, availability: 'available', seed: 1 },
    { id: 'a_luca', name: 'Luca Moretti', position: 'Midfielder', age: 17, readiness: 54, sleepH: 6.2, acwr: 1.64, checkins7: 6, availability: 'available', seed: 2 },
    { id: 'a_ben', name: 'Ben Okafor', position: 'Defender', age: 18, readiness: 71, sleepH: 7.4, acwr: 0.96, checkins7: 3, availability: 'available', seed: 3 },
    { id: 'a_noah', name: 'Noah Kim', position: 'Goalkeeper', age: 17, readiness: 46, sleepH: 5.9, acwr: 1.21, checkins7: 7, availability: 'available', seed: 4 },
    { id: 'a_eli', name: 'Eli Santos', position: 'Midfielder', age: 18, readiness: 77, sleepH: 7.8, acwr: 1.38, checkins7: 5, availability: 'modify', seed: 5 },
    { id: 'a_omar', name: 'Omar Haddad', position: 'Defender', age: 17, readiness: 68, sleepH: 7.1, acwr: 1.05, checkins7: 6, availability: 'available', seed: 6 },
  ];
  return base.map((a) => ({ ...a, sample: true, readiness7: Array.from({ length: 7 }, (_, i) => Math.round(Math.max(30, Math.min(95, a.readiness + wave(i, a.seed, 9) - (6 - i) * (a.readiness < 60 ? -2 : 0))))), load7: Array.from({ length: 7 }, (_, i) => Math.round(Math.max(0, 300 + wave(i, a.seed + 2, 180) + (a.acwr > 1.5 && i > 3 ? 220 : 0)))) }));
}

// ---------------- employer (group totals only) ----------------
export function employerProgram(liveJoined) {
  const depts = [
    { name: 'Operations', enrolled: 96, active: 0.68, sleepH: 6.6, sleepTrend: -0.3, steps: 9100, stress: 'Rising', challenge: 0.52 },
    { name: 'Engineering', enrolled: 58, active: 0.81, sleepH: 6.9, sleepTrend: -0.2, steps: 6400, stress: 'Steady', challenge: 0.61 },
    { name: 'Sales', enrolled: 41, active: 0.73, sleepH: 7.0, sleepTrend: 0.1, steps: 7300, stress: 'Rising', challenge: 0.66 },
    { name: 'People and Finance', enrolled: 27, active: 0.85, sleepH: 7.3, sleepTrend: 0.2, steps: 7900, stress: 'Easing', challenge: 0.7 },
    { name: 'Leadership', enrolled: 8, active: 0.88, sleepH: 6.8, sleepTrend: 0, steps: 8200, stress: 'Steady', challenge: 0.5 },
  ];
  const enrolled = depts.reduce((a, d) => a + d.enrolled, 0) + (liveJoined ? 1 : 0);
  const eligible = 412;
  const shown = depts.map((d) => (d.enrolled < 10 ? { name: d.name, enrolled: d.enrolled, hidden: true } : d));
  const wavg = (k) => round(depts.reduce((a, d) => a + d[k] * d.enrolled, 0) / depts.reduce((a, d) => a + d.enrolled, 0), k === 'steps' ? 0 : 1);
  return {
    org: PRO_ROLES.employer.person.org, eligible, enrolled, enrollRate: round((enrolled / eligible) * 100), activeRate: round(wavg('active') * 100),
    sleepH: wavg('sleepH'), steps: wavg('steps'), challengeRate: round(wavg('challenge') * 100),
    weeks: Array.from({ length: 8 }, (_, i) => ({ week: i + 1, active: round(62 + i * 1.6 + wave(i, 3, 2)), sleepH: round(6.7 + wave(i, 1, 0.15) + (i > 5 ? -0.2 : 0), 1) })),
    depts: shown,
    insights: [
      { level: 'warn', text: 'Sleep in Operations fell by 0.3 h a night over the last 3 weeks, in line with the night-shift rota change.' },
      { level: 'info', text: 'Stress check-ins rise in Sales and Operations at month end. A short breathing challenge in that week is suggested.' },
      { level: 'good', text: 'People taking part in the step challenge average 1,900 more steps a day than those who are not.' },
    ],
    challenges: [
      { name: 'Step into spring', kind: 'Steps', joined: 141, days: 21, dayNow: 9 },
      { name: 'Wind down by 10:30', kind: 'Sleep', joined: 88, days: 14, dayNow: 14 },
    ],
  };
}

// ---------------- provider ----------------
const HIGHER_IS_WORSE = ['hba1c', 'ldl', 'tg', 'glucose', 'apob', 'crp', 'hscrp'];
export function providerAlerts(p) {
  const out = [];
  for (const l of p.labs || []) {
    const off = l.status !== 'Optimal' && l.status !== 'In range';
    const worse = l.prev != null && (HIGHER_IS_WORSE.includes(l.key) ? l.value > l.prev : l.value < l.prev);
    if (off && worse) out.push({ level: 'warn', key: `rise_${l.key}`, text: `${l.name} ${l.value > l.prev ? 'up' : 'down'} from ${l.prev} to ${l.value} ${l.unit}` });
    else if (off && l.prev != null) out.push({ level: 'good', key: `better_${l.key}`, text: `${l.name} improving (${l.prev} to ${l.value} ${l.unit}), not yet optimal` });
    else if (off) out.push({ level: 'info', key: `lab_${l.key}`, text: `${l.name} ${l.value} ${l.unit} outside the optimal range` });
  }
  if (p.labsMonthsAgo != null && p.labsMonthsAgo >= 12) out.push({ level: 'warn', key: 'overdue', text: `Last labs ${p.labsMonthsAgo} months ago, follow-up due` });
  if (p.rhrTrend != null && p.rhrTrend >= 5) out.push({ level: 'warn', key: 'rhr', text: `Resting heart rate up ${p.rhrTrend} bpm over 30 days` });
  if (p.weightChange90 != null && Math.abs(p.weightChange90) >= 0.05 * (p.weightKg || 70)) out.push({ level: 'info', key: 'weight', text: `Weight ${p.weightChange90 < 0 ? 'down' : 'up'} ${Math.abs(p.weightChange90)} kg in 90 days` });
  if (p.sleepAvg != null && p.sleepAvg < 6.5) out.push({ level: 'info', key: 'sleep', text: `Sleeping ${p.sleepAvg} h a night on average` });
  return out;
}
export function samplePatients() {
  return [
    { id: 'p_grace', name: 'Grace Holloway', age: 58, sex: 'female', conditions: ['Prediabetes', 'Hypertension'], weightKg: 81.4, weightChange90: -2.1, rhr: 71, rhrTrend: 2, sleepAvg: 6.8, stepsAvg: 6200, labsMonthsAgo: 4,
      labs: [{ key: 'hba1c', name: 'HbA1c', value: 6.2, prev: 5.9, unit: '%', status: 'Worth a look' }, { key: 'ldl', name: 'LDL cholesterol', value: 118, prev: 131, unit: 'mg/dL', status: 'In range' }],
      lastVisit: -84, nextVisit: 10, sample: true },
    { id: 'p_tom', name: 'Tom Becker', age: 46, sex: 'male', conditions: ['High cholesterol'], weightKg: 94.0, weightChange90: 1.2, rhr: 68, rhrTrend: 6, sleepAvg: 6.1, stepsAvg: 4800, labsMonthsAgo: 14,
      labs: [{ key: 'ldl', name: 'LDL cholesterol', value: 162, prev: 149, unit: 'mg/dL', status: 'Worth a look' }],
      lastVisit: -410, nextVisit: null, sample: true },
    { id: 'p_ana', name: 'Ana Ruiz', age: 39, sex: 'female', conditions: ['Iron deficiency'], weightKg: 63.2, weightChange90: -0.4, rhr: 62, rhrTrend: -1, sleepAvg: 7.4, stepsAvg: 8900, labsMonthsAgo: 2,
      labs: [{ key: 'ferritin', name: 'Ferritin', value: 24, prev: 11, unit: 'ng/mL', status: 'Worth a look' }],
      lastVisit: -60, nextVisit: 30, sample: true },
    { id: 'p_will', name: 'William Grant', age: 67, sex: 'male', conditions: ['Type 2 diabetes'], weightKg: 88.7, weightChange90: -5.2, rhr: 74, rhrTrend: 1, sleepAvg: 7.0, stepsAvg: 5100, labsMonthsAgo: 3,
      labs: [{ key: 'hba1c', name: 'HbA1c', value: 7.1, prev: 7.6, unit: '%', status: 'Worth a look' }],
      lastVisit: -95, nextVisit: 5, sample: true },
  ];
}
