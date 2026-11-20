// AI proxy for the no-database mode: the app keeps data in the browser but still uses Claude on the server.
import { NextResponse } from 'next/server';
import { anthropicAI } from '../../../../server/ai-anthropic.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ai = anthropicAI();
const hits = new Map(); // simple per-IP rate limit: 30 calls per 10 minutes
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 600000);
  h.push(now); hits.set(ip, h);
  return h.length > 30;
}

export async function GET() { return NextResponse.json({ available: ai.available() }); }

export async function POST(req, { params }) {
  const { kind } = await params;
  if (!ai.available()) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  if (!['genie', 'food', 'labs'].includes(kind)) return NextResponse.json({ error: 'Unknown' }, { status: 404 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  if (limited(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || JSON.stringify(body).length > 3_000_000) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try { return NextResponse.json({ result: await ai[kind](body) }); }
  catch (e) { console.error('[ai]', e); return NextResponse.json({ error: 'AI request failed' }, { status: 502 }); }
}
