// Wearable adapter registry used in the browser demo: simulated data only.
// The server version (server/wearables) adds Open Wearables and Junction adapters with the same interface.
import { simulateRange } from '../engine/simulate.js';

export function simulatedWearables() {
  return {
    providers: () => [{ id: 'simulated', name: 'Simulated data', ready: true }],
    async connect() { return { ok: true }; },
    async fetch({ seed, device, from, to, periods }) {
      return simulateRange({ seed: seed || 'seed', device, from, to, periods });
    },
  };
}
