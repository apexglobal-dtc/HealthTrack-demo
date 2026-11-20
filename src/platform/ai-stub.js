// No AI connected: Genie, food photos and lab reading fall back to deterministic logic.
export function stubAI() {
  return { available: () => false, async genie() { throw new Error('AI not connected'); }, async food() { throw new Error('AI not connected'); }, async labs() { throw new Error('AI not connected'); } };
}
