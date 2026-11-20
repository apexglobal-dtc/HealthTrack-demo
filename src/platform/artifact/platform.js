// The browser-only platform: runs the whole Health Track service inside the page.
// Storage: the viewer's private Artifact database (or localStorage). Wearables: simulated.
// AI: the Artifact `sample` capability (Claude), with the deterministic stub as fallback.
import { createService } from '../../service/service.js';
import { simulatedWearables } from '../wearables.js';
import { createKV } from './browserKV.js';
import { foodPrompt, labsPrompt, parseJson, dataUrlToBlob } from '../aiPrompts.js';
import { uid } from '../../engine/util.js';

async function hash(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'x' + h; }
}

export async function createArtifactPlatform(opts = {}) {
  const claude = typeof window !== 'undefined' ? window.claude : null;
  const kv = createKV();
  const kvReady = kv.init(claude);

  // capabilities resolve lazily; the app works without any of them
  const caps = { sample: null, dictation: null, tts: null, downloads: null };
  let sampleDenied = false;
  if (claude?.use) {
    for (const name of Object.keys(caps)) claude.use(name).then((ns) => { caps[name] = ns; }).catch(() => {});
  }

  const store = {
    async get(u, key) { await kvReady; return kv.get(`u:${u}:${key}`) ?? null; },
    async set(u, key, value) { await kvReady; kv.set(`u:${u}:${key}`, value); },
    async del(u, key) { await kvReady; kv.del(`u:${u}:${key}`); },
  };

  async function ask(input, opts = {}) {
    try {
      return await caps.sample.json(input, { cache: false, ...opts });
    } catch (e) {
      if (e?.code === 'not_granted' || e?.code === 'sampling_disabled') sampleDenied = true;
      if (e?.text) { const j = parseJson(e.text); if (j) return j; }
      throw e;
    }
  }

  const ai = {
    available: () => !!caps.sample && !sampleDenied,
    async genie({ system, messages }) {
      // sample has no system role: the rules go first, in the opening user turn
      const turns = messages.map((m) => ({ role: m.role, content: String(m.content) }));
      const first = turns.findIndex((m) => m.role === 'user');
      const input = first >= 0 ? turns.slice(first) : turns;
      input[0] = { role: 'user', content: `${system}\n\n---\n\n${input[0].content}` };
      const r = parseJson(await ask(input, { modelTier: 'default' }));
      return r ? { ...r, model: 'claude' } : null;
    },
    async food({ image, note, foodNames }) {
      const opts = { modelTier: 'default' };
      let hasImage = false;
      if (image) {
        try { const lim = await caps.sample.limits(); if (lim?.images) { opts.images = [dataUrlToBlob(image)]; hasImage = true; } } catch (e) {}
      }
      if (!hasImage && !note) throw new Error('nothing to analyze');
      const r = parseJson(await ask(foodPrompt({ note, foodNames, hasImage }), opts));
      return { items: Array.isArray(r?.items) ? r.items : [], model: 'claude' };
    },
    async labs({ text, markers }) {
      return parseJson(await ask(labsPrompt({ text, markers }), { modelTier: 'quick' }));
    },
  };

  const aiImpl = opts.ai || ai;
  const service = createService({ store, wearables: simulatedWearables(), ai: aiImpl });

  // ---------------- local accounts (demo auth) ----------------
  const ACC = 'auth:accounts';
  const SES = 'auth:session';
  const accounts = () => kv.get(ACC) || {};
  let session = null;
  const auth = {
    async session() { await kvReady; session = kv.get(SES) || null; return session; },
    async signUp({ email, password, name }) {
      await kvReady;
      const e = String(email).trim().toLowerCase();
      const a = accounts();
      if (a[e]) throw new Error('An account with this email already exists. Sign in instead.');
      const id = uid('user');
      a[e] = { id, email: e, name, pw: await hash(e + ':' + password), created: Date.now() };
      kv.set(ACC, a);
      // Demo: no email is sent, so sign-up signs in straight away. The server build uses Supabase email confirmation.
      session = { userId: id, email: e }; kv.set(SES, session);
      return session;
    },
    async signIn({ email, password }) {
      await kvReady;
      const e = String(email).trim().toLowerCase();
      const acc = accounts()[e];
      if (!acc || acc.pw !== (await hash(e + ':' + password))) throw new Error('Email or password is not right.');
      session = { userId: acc.id, email: e }; kv.set(SES, session);
      return session;
    },
    async signOut() { session = null; kv.del(SES); },
    async forgot({ email }) {
      const e = String(email).trim().toLowerCase();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      if (accounts()[e]) kv.set('auth:code:' + e, { code, purpose: 'reset', exp: Date.now() + 10 * 60000 });
      return { demoCode: accounts()[e] ? code : null };
    },
    async reset({ email, code, password }) {
      const e = String(email).trim().toLowerCase();
      const c = kv.get('auth:code:' + e);
      if (!c || c.code !== String(code) || c.exp < Date.now()) throw new Error('That code is not right or has expired.');
      const a = accounts(); a[e].pw = await hash(e + ':' + password); a[e].verified = true; kv.set(ACC, a); kv.del('auth:code:' + e);
      session = { userId: a[e].id, email: e }; kv.set(SES, session);
      return session;
    },
    async demo({ reset } = {}) {
      await kvReady;
      const id = 'demo-maya';
      session = { userId: id, email: 'maya@demo.healthtrack', demo: true }; kv.set(SES, session);
      const has = await store.get(id, 'profile');
      if (!has || reset || has.createdAtSeed !== new Date().toISOString().slice(0, 10)) {
        // re-seed daily so the demo month always ends today
        await service.seedDemoPersona(id);
        const p = await store.get(id, 'profile'); p.createdAtSeed = new Date().toISOString().slice(0, 10); await store.set(id, 'profile', p);
        await store.set(id, 'chat', { messages: [], actions: [] });
      }
      return session;
    },
  };

  async function call(method, args) {
    await kvReady;
    if (!session) session = kv.get(SES) || null;
    if (!session) throw new Error('Please sign in');
    if (typeof service[method] !== 'function') throw new Error(`Unknown method ${method}`);
    return service[method](session.userId, args || {});
  }

  const info = {
    mode: opts.mode || 'artifact',
    get aiLabel() { return aiImpl.available() ? 'Claude' : null; },
    wearablesLabel: 'Simulated data (Open Wearables or Junction in the server build)',
    storage: () => kv.mode(),
    get dictate() {
      if (!caps.dictation) return null;
      return ({ onText, onEnd }) => {
        const d = caps.dictation;
        const p = d.start(); // must run straight from the click
        const offs = [d.onFinal(({ text }) => onText?.(text)), d.onState(({ state }) => { if (state === 'idle') { offs.forEach((f) => f()); onEnd?.(); } })];
        return p.then(() => () => d.stop()).catch((e) => { offs.forEach((f) => f()); onEnd?.(); throw e; });
      };
    },
    get speak() { return caps.tts ? (text) => caps.tts.speak(String(text).slice(0, 1900)) : null; },
    get download() { return caps.downloads ? ({ filename, text }) => caps.downloads.save({ filename, data: text }) : null; },
  };

  return { call, auth, info };
}
