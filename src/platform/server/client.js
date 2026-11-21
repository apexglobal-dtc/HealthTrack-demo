// Browser side of the server build: Supabase Auth for accounts, /api/rpc for every app call.
import { createClient } from '@supabase/supabase-js';

export function createServerPlatform({ url, anonKey }) {
  const sb = createClient(url, anonKey);
  const token = async () => (await sb.auth.getSession()).data.session?.access_token;
  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  async function call(method, args) {
    const t = await token();
    if (!t) throw new Error('Please sign in');
    const r = await fetch(`/api/rpc/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, 'x-tz-offset': String(new Date().getTimezoneOffset()) }, body: JSON.stringify({ args: args || {} }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Request failed (${r.status})`); e.status = r.status; throw e; }
    return j.result;
  }

  const auth = {
    async session() { const s = (await sb.auth.getSession()).data.session; return s ? { userId: s.user.id, email: s.user.email } : null; },
    async signUp({ email, password, name }) {
      const d = must(await sb.auth.signUp({ email, password, options: { data: { name } } }));
      if (!d.session) throw new Error('Check your email to confirm your account, then sign in.');
      return d.session;
    },
    async signIn({ email, password }) { return must(await sb.auth.signInWithPassword({ email, password })).session; },
    async signOut() { await sb.auth.signOut(); },
    async forgot({ email }) { must(await sb.auth.resetPasswordForEmail(email)); return { demoCode: null }; },
    async reset({ email, code, password }) {
      must(await sb.auth.verifyOtp({ email, token: code, type: 'recovery' }));
      return must(await sb.auth.updateUser({ password }));
    },
    async demo({ reset } = {}) {
      let s = (await sb.auth.getSession()).data.session;
      if (!s || !s.user.is_anonymous) { s = must(await sb.auth.signInAnonymously()).session; reset = true; }
      if (!reset) { const b = await call('bootstrap'); if (b.profile) return s; }
      await call('seedDemoPersona');
      return s;
    },
  };

  const info = {
    mode: 'server',
    aiLabel: null, // set after bootstrap
    wearablesLabel: 'Open Wearables or Junction when configured, otherwise simulated',
    download: null, dictate: null, speak: null,
  };
  return { call: async (m, a) => { const r = await call(m, a); if (m === 'bootstrap') info.aiLabel = r?.ai ? 'Claude' : null; return r; }, auth, info };
}

// AI over HTTP for the no-database mode (data stays in the browser, Claude runs on the server).
export function remoteAI(status) {
  const post = async (kind, body) => {
    const r = await fetch(`/api/ai/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('AI request failed');
    return (await r.json()).result;
  };
  return { available: () => !!status, genie: (b) => post('genie', b), food: (b) => post('food', b), labs: (b) => post('labs', b) };
}
