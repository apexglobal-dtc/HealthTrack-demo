// Prompts shared by both AI adapters (Claude Artifact `sample` and the server Anthropic SDK).
// Every model answer is parsed as JSON and validated by the service before it is shown.

export function foodPrompt({ note, foodNames, hasImage }) {
  return `You estimate what is on a plate for a wellness app's food log.
${hasImage ? 'Look at the photo.' : 'There is no photo; use the description only.'}${note ? `\nThe user's note: "${String(note).slice(0, 300)}"` : ''}
List each distinct food (max 6). For each give a gram range for the portion shown and your confidence 0..1.
Prefer names from this food list when one fits (use the exact name in "match"): ${foodNames.slice(0, 120).join('; ')}.
Reply with ONLY JSON: {"items":[{"name":string,"match":string|null,"grams_low":number,"grams_high":number,"confidence":number}]}`;
}

export function labsPrompt({ text, markers }) {
  return `Extract blood test results from this lab report text for a wellness app. Only extract these markers:
${markers.map((m) => `- ${m.key}: ${m.name} (usual unit ${m.unit})`).join('\n')}
For each marker found, return the numeric result exactly as printed, its unit, and a short snippet of the source line. Also find the collection date (YYYY-MM-DD) if present. Do not interpret or diagnose. Skip markers that are not present.
Reply with ONLY JSON: {"testDate": string|null, "markers":[{"key":string,"value":number,"unit":string,"snippet":string}]}

REPORT TEXT:
${text}`;
}

export function parseJson(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  const s = String(text);
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
