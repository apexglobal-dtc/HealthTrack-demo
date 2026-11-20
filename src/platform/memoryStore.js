// In-memory document store (tests and local development without a database).
export function memoryStore() {
  const m = new Map();
  const k = (u, key) => `${u}::${key}`;
  return {
    async get(u, key) { const v = m.get(k(u, key)); return v === undefined ? null : structuredClone(v); },
    async set(u, key, value) { m.set(k(u, key), structuredClone(value)); },
    async del(u, key) { m.delete(k(u, key)); },
  };
}
