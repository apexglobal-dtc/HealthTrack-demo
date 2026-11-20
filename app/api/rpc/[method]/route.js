import { NextResponse } from 'next/server';
import { hasSupabase } from '../../../../server/env.js';
import { userFromRequest } from '../../../../server/store-supabase.js';
import { getService, PUBLIC_METHODS } from '../../../../server/service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const { method } = await params;
  if (!hasSupabase()) return NextResponse.json({ error: 'Server database is not configured' }, { status: 503 });
  if (!PUBLIC_METHODS.has(method)) return NextResponse.json({ error: 'Unknown method' }, { status: 404 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  if (method === 'seedDemoPersona' && !user.is_anonymous) return NextResponse.json({ error: 'Demo data is only for demo sessions' }, { status: 403 });
  let args = {};
  try { const body = await req.json(); args = body?.args || {}; } catch (e) {}
  if (JSON.stringify(args).length > 2_000_000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  try {
    const result = await getService()[method](user.id, args);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    console.error(`[rpc ${method}]`, e);
    return NextResponse.json({ error: e.code === 'no_profile' ? e.message : 'Something went wrong' }, { status: e.code === 'no_profile' ? 409 : 500 });
  }
}
