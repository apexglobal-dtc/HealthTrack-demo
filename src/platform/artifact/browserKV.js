// Key-value persistence for the browser demo.
// Primary: the Artifact's private per-viewer database (data/users/<viewer>/...), so a viewer's data follows them.
// Fallback: localStorage, then memory. Reads are synchronous from an in-memory copy; writes persist in the background.
const LS_PREFIX = 'ht-demo:';

export function createKV() {
  const mem = new Map();
  let db = null, coll = null, ready = null, mode = 'memory';
  const pending = new Map();
  let flushing = false;

  const ls = {
    get(k) { try { const v = localStorage.getItem(LS_PREFIX + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } },
    set(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {} },
    keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).map((k) => k.slice(LS_PREFIX.length)); } catch (e) { return []; } },
  };
  const docId = (k) => k.replace(/[^A-Za-z0-9_-]/g, '_');

  async function flush() {
    if (flushing || !coll) return;
    flushing = true;
    try {
      while (pending.size) {
        const [k, v] = pending.entries().next().value;
        pending.delete(k);
        try {
          if (v === undefined) await coll.doc(docId(k)).delete();
          else await coll.doc(docId(k)).set({ k, json: JSON.stringify(v), at: Date.now() });
        } catch (e) { /* keep local copy; the database is best effort */ }
      }
    } finally { flushing = false; }
  }

  async function init(claude) {
    if (ready) return ready;
    ready = (async () => {
      for (const k of ls.keys()) mem.set(k, ls.get(k));
      mode = ls.set('_probe', 1) ? 'local' : 'memory';
      try {
        if (!claude?.use) return mode;
        const timeout = new Promise((r) => setTimeout(() => r(null), 3500));
        const [dbNs, userNs] = await Promise.race([Promise.all([claude.use('db'), claude.use('user')]), timeout.then(() => [null, null])]);
        if (!dbNs || !userNs) return mode;
        const id = await userNs.id();
        if (!id) return mode;
        db = dbNs; coll = db.collection('data/users/' + id);
        const snap = await Promise.race([coll.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
        if (snap.size) {
          // the database copy wins: it is the viewer's own data across devices
          for (const d of snap.docs) { const x = d.data(); if (x?.k) { try { mem.set(x.k, JSON.parse(x.json)); ls.set(x.k, mem.get(x.k)); } catch (e) {} } }
        } else {
          for (const [k, v] of mem) if (k !== '_probe') pending.set(k, v);
          flush();
        }
        mode = 'cloud';
      } catch (e) { /* stay on local storage */ }
      return mode;
    })();
    return ready;
  }

  return {
    init,
    mode: () => mode,
    get: (k) => (mem.has(k) ? structuredClone(mem.get(k)) : undefined),
    set: (k, v) => { mem.set(k, structuredClone(v)); ls.set(k, v); if (coll) { pending.set(k, v); flush(); } },
    del: (k) => { mem.delete(k); ls.del(k); if (coll) { pending.set(k, undefined); flush(); } },
    keys: () => [...mem.keys()],
  };
}
