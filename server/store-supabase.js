// Store adapter backed by Supabase Postgres: one JSON document per (user, key) in table user_docs.
// The server uses the service-role key and always filters by the verified user id; RLS also protects the table.
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let admin = null;
export function adminClient() {
  if (!admin) admin = createClient(env.supabaseUrl, env.supabaseService, { auth: { persistSession: false } });
  return admin;
}

export function supabaseStore() {
  const db = adminClient();
  return {
    async get(u, key) {
      const { data, error } = await db.from('user_docs').select('data').eq('user_id', u).eq('key', key).maybeSingle();
      if (error) throw error;
      return data?.data ?? null;
    },
    async set(u, key, value) {
      const { error } = await db.from('user_docs').upsert({ user_id: u, key, data: value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async del(u, key) {
      const { error } = await db.from('user_docs').delete().eq('user_id', u).eq('key', key);
      if (error) throw error;
    },
  };
}

// Verify the caller's Supabase access token and return their user id.
export async function userFromRequest(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
