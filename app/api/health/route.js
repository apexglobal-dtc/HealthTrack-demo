import { NextResponse } from 'next/server';
import { health } from '../../../server/diagnose.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(await health()); }
