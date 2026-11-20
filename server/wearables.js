// Wearable data adapters for the server build. All share one interface:
//   providers() -> [{ id, name, ready }]
//   connect({ userId, device, provider }) -> { ok } or { redirectUrl } (the user authorizes in a new tab)
//   fetch({ userId, seed, device, provider, from, to, periods }) -> { nights, steps, workouts }
// The output shape is the one simulate.js produces (night: date, bedStartMin, bedEndMin, tstH, eff, deepH, remH, hrv, hrvMethod, rhr, skinTempDev),
// so the scoring engine does not care where data came from.
//
// IMPORTANT: the Open Wearables and Junction request/response mappings below are written from their
// public docs and have NOT been run against a live account yet. Check each TODO with the sandbox
// credentials before the first real user connects a device.
import { simulateRange } from '../src/engine/simulate.js';
import { env } from './env.js';

const simulated = {
  id: 'simulated', name: 'Simulated data', ready: () => true,
  async connect() { return { ok: true }; },
  async fetch({ seed, device, from, to, periods }) { return simulateRange({ seed: seed || 'seed', device, from, to, periods }); },
};

// ---------- Junction (formerly Vital) ----------
// Docs: https://docs.junction.com  · Sandbox keys come from the Junction dashboard.
const JUNCTION_BASE = process.env.JUNCTION_BASE_URL || (env.junctionEnv === 'production' ? `https://api.${env.junctionRegion}.junction.com` : `https://api.sandbox.${env.junctionRegion}.junction.com`);
async function junction(path, init = {}) {
  const r = await fetch(JUNCTION_BASE + path, { ...init, headers: { 'x-vital-api-key': env.junctionKey, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Junction ${path}: ${r.status}`);
  return r.json();
}
const junctionIds = new Map(); // TODO: persist the Junction user id in user_docs ('devices' doc) instead of memory
async function junctionUser(userId) {
  if (junctionIds.has(userId)) return junctionIds.get(userId);
  const u = await junction('/v2/user', { method: 'POST', body: JSON.stringify({ client_user_id: userId }) }).catch(async () => junction(`/v2/user/resolve/${userId}`));
  junctionIds.set(userId, u.user_id);
  return u.user_id;
}
const junctionAdapter = {
  id: 'junction', name: 'Junction', ready: () => !!env.junctionKey,
  async connect({ userId, device }) {
    const id = await junctionUser(userId);
    const t = await junction('/v2/link/token', { method: 'POST', body: JSON.stringify({ user_id: id, provider: device }) });
    return { redirectUrl: t.link_web_url };
  },
  async fetch({ userId, from, to }) {
    const id = await junctionUser(userId);
    const q = `?start_date=${from}&end_date=${to}`;
    const [sleep, activity, workouts] = await Promise.all([
      junction(`/v2/summary/sleep/${id}${q}`), junction(`/v2/summary/activity/${id}${q}`), junction(`/v2/summary/workouts/${id}${q}`),
    ]);
    // TODO verify field names against a sandbox response
    const nights = (sleep.sleep || []).map((s) => {
      const start = new Date(s.bedtime_start), end = new Date(s.bedtime_stop);
      return {
        date: String(s.calendar_date || s.date).slice(0, 10), bedStartMin: start.getHours() * 60 + start.getMinutes(), bedEndMin: end.getHours() * 60 + end.getMinutes(), stages: s.deep != null,
        tstH: (s.total || 0) / 3600, eff: s.efficiency != null ? s.efficiency / 100 : null, deepH: (s.deep || 0) / 3600, remH: (s.rem || 0) / 3600,
        hrv: s.average_hrv ?? null, hrvMethod: 'rmssd', rhr: s.hr_lowest ?? s.hr_average ?? null, skinTempDev: s.temperature_delta ?? null, source: s.source?.slug || 'junction',
      };
    });
    const steps = (activity.activity || []).map((a) => ({ date: String(a.calendar_date || a.date).slice(0, 10), steps: a.steps ?? 0 }));
    const wos = (workouts.workouts || []).map((w) => {
      const st = new Date(w.time_start);
      return { id: `w_junction_${w.id}`, date: st.toISOString().slice(0, 10), startMin: st.getHours() * 60 + st.getMinutes(), type: w.sport?.name || 'Workout', minutes: Math.round(((new Date(w.time_end) - st) / 60000) || 0), avgHr: w.average_hr ?? null, maxHr: w.max_hr ?? null, distanceKm: w.distance ? w.distance / 1000 : null, strength: /strength|weight/i.test(w.sport?.name || ''), source: w.source?.slug || 'junction' };
    });
    return { nights, steps, workouts: wos };
  },
};

// ---------- Open Wearables (self-hosted) ----------
// Open-source platform you run on your own server (Docker). Set OPEN_WEARABLES_URL and an API key.
async function ow(path, init = {}) {
  const r = await fetch(env.openWearablesUrl.replace(/\/$/, '') + path, { ...init, headers: { authorization: `Bearer ${env.openWearablesKey}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Open Wearables ${path}: ${r.status}`);
  return r.json();
}
const openWearablesAdapter = {
  id: 'open_wearables', name: 'Open Wearables (self-hosted)', ready: () => !!(env.openWearablesUrl && env.openWearablesKey),
  async connect({ userId, device }) {
    // TODO confirm the connect endpoint in your Open Wearables version
    const r = await ow(`/api/v1/users/${encodeURIComponent(userId)}/connections/${device}/authorize`, { method: 'POST' });
    return r.authorization_url ? { redirectUrl: r.authorization_url } : { ok: true };
  },
  async fetch({ userId, from, to }) {
    // TODO confirm endpoint paths and field names against your deployment's API docs (/docs on the server)
    const q = `?start_date=${from}&end_date=${to}`;
    const [sleep, daily, workouts] = await Promise.all([
      ow(`/api/v1/users/${encodeURIComponent(userId)}/sleep${q}`), ow(`/api/v1/users/${encodeURIComponent(userId)}/daily${q}`), ow(`/api/v1/users/${encodeURIComponent(userId)}/workouts${q}`),
    ]);
    const toMin = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
    return {
      nights: (sleep.data || sleep || []).map((s) => ({ date: String(s.date).slice(0, 10), bedStartMin: toMin(s.start_time), bedEndMin: toMin(s.end_time), stages: s.deep_seconds != null, tstH: (s.duration_seconds || 0) / 3600, eff: s.efficiency ?? null, deepH: (s.deep_seconds || 0) / 3600, remH: (s.rem_seconds || 0) / 3600, hrv: s.hrv_avg ?? null, hrvMethod: s.hrv_method || 'rmssd', rhr: s.resting_hr ?? null, skinTempDev: s.temperature_deviation ?? null, source: s.provider || 'open_wearables' })),
      steps: (daily.data || daily || []).map((d) => ({ date: String(d.date).slice(0, 10), steps: d.steps ?? 0 })),
      workouts: (workouts.data || workouts || []).map((w) => ({ id: `w_ow_${w.id}`, date: String(w.start_time).slice(0, 10), startMin: toMin(w.start_time), type: w.type || 'Workout', minutes: Math.round((w.duration_seconds || 0) / 60), avgHr: w.avg_hr ?? null, maxHr: w.max_hr ?? null, distanceKm: w.distance_meters ? w.distance_meters / 1000 : null, strength: /strength/i.test(w.type || ''), source: w.provider || 'open_wearables' })),
    };
  },
};

const ADAPTERS = [simulated, openWearablesAdapter, junctionAdapter];

export function serverWearables() {
  const by = (id) => ADAPTERS.find((a) => a.id === id) || simulated;
  return {
    providers: () => ADAPTERS.map((a) => ({ id: a.id, name: a.name, ready: a.ready() })),
    async connect(args) { const a = by(args.provider); if (!a.ready()) throw new Error(`${a.name} is not configured on the server`); return a.connect(args); },
    async fetch(args) {
      const a = by(args.provider);
      if (!a.ready()) return simulated.fetch(args);
      return a.fetch(args);
    },
  };
}
