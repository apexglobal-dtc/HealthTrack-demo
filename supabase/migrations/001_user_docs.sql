-- Health Track: one JSON document per user and key (profile, days, train, cycle, labs, chat, memory, devices, reminders, history).
create table if not exists public.user_docs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_docs enable row level security;

-- The API server uses the service-role key (which bypasses RLS) and always filters by the verified user.
-- These policies also let a signed-in user read and write only their own rows if you ever query from the browser.
create policy "own rows: select" on public.user_docs for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.user_docs for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.user_docs for update using (auth.uid() = user_id);
create policy "own rows: delete" on public.user_docs for delete using (auth.uid() = user_id);
