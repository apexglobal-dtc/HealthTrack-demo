// Turns Supabase/config failures into plain messages, and powers /api/health (no secrets are returned).
import { env, hasSupabase } from './env.js';
import { adminClient } from './store-supabase.js';

export function keyKind(k) {
  if (!k) return 'missing';
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  const parts = k.split('.');
  if (parts.length === 3) {
    try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role || 'jwt'; } catch (e) { return 'unreadable'; }
  }
  return 'unknown';
}

export function explain(e) {
  const code = e?.code || '';
  const msg = String(e?.message || e || '');
  if (code === '42P01' || code === 'PGRST205' || /relation .*user_docs.* does not exist|Could not find the table/i.test(msg)) return 'Setup: the user_docs table is missing. Run supabase/migrations/001_user_docs.sql in the Supabase SQL Editor.';
  if (code === '42501' || /row-level security/i.test(msg)) return 'Setup: SUPABASE_SERVICE_ROLE_KEY in Vercel is not the service_role (secret) key.';
  if (/Invalid API key|JWT|apikey/i.test(msg)) return 'Setup: the Supabase keys in Vercel do not match this Supabase project.';
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) return 'Setup: NEXT_PUBLIC_SUPABASE_URL in Vercel is wrong or unreachable.';
  return null;
}

export async function health() {
  const out = {
    supabaseConfigured: hasSupabase(),
    supabaseUrl: env.supabaseUrl ? env.supabaseUrl.replace(/^https:\/\/([^.]{4})[^.]*/, 'https://$1…') : 'missing',
    anonKey: keyKind(env.supabaseAnon),
    serviceKey: keyKind(env.supabaseService),
    claude: !!env.anthropicKey,
    model: env.model,
  };
  if (out.supabaseConfigured) {
    try {
      const { error } = await adminClient().from('user_docs').select('key').limit(1);
      out.database = error ? (explain(error) || `error ${error.code || ''} ${error.message || ''}`.trim()) : 'ok';
    } catch (e) { out.database = explain(e) || 'error'; }
    try {
      const { error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
      out.adminAuth = error ? (explain(error) || 'error') : 'ok';
    } catch (e) { out.adminAuth = explain(e) || 'error'; }
  }
  return out;
}
