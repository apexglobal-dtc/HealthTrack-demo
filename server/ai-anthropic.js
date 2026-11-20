// Health Genie, food photo estimates and lab reading through the Claude API (Anthropic SDK).
// Every reply is JSON that the service validates (numbers checked against the data packet) before showing it.
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';
import { foodPrompt, labsPrompt, parseJson } from '../src/platform/aiPrompts.js';

export function anthropicAI() {
  if (!env.anthropicKey) return { available: () => false, genie: nope, food: nope, labs: nope };
  const client = new Anthropic({ apiKey: env.anthropicKey });
  async function ask({ system, messages, maxTokens = 1200 }) {
    const res = await client.messages.create({ model: env.model, max_tokens: maxTokens, ...(system ? { system } : {}), messages });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return parseJson(text);
  }
  return {
    available: () => true,
    async genie({ system, messages }) {
      const r = await ask({ system, messages: messages.map((m) => ({ role: m.role, content: String(m.content) })) });
      return r ? { ...r, model: env.model } : null;
    },
    async food({ image, note, foodNames }) {
      const content = [];
      const m = image && /^data:(image\/[a-z+]+);base64,(.+)$/.exec(image);
      if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      content.push({ type: 'text', text: foodPrompt({ note, foodNames, hasImage: !!m }) });
      const r = await ask({ messages: [{ role: 'user', content }], maxTokens: 800 });
      return { items: Array.isArray(r?.items) ? r.items : [], model: env.model };
    },
    async labs({ text, markers }) {
      return ask({ messages: [{ role: 'user', content: labsPrompt({ text, markers }) }], maxTokens: 1500 });
    },
  };
}
async function nope() { throw new Error('AI not configured'); }
