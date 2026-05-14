-- ============================================================
-- Capi - Dominican Dominoes  |  Bug Reports
-- Run this in the Supabase SQL Editor (after 001 and 002).
-- ============================================================

create table if not exists public.bug_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  game_id       uuid references public.games(id) on delete set null,
  player_id     uuid references public.players(id) on delete set null,
  message       text not null,
  user_agent    text,
  url           text,
  viewport_w    integer,
  viewport_h    integer,
  language      text,
  game_state    jsonb,
  state_version integer
);

alter table public.bug_reports enable row level security;

-- Public inserts are fine: anyone playing the game can submit a report.
-- We rely on app-level rate limiting + the API route to validate payloads.
-- Note: `TO anon, authenticated` is explicit on purpose — relying on the
-- default `PUBLIC` role can be flaky depending on Supabase's role grants.
create policy "bug_reports: public insert"
  on public.bug_reports
  for insert
  to anon, authenticated
  with check (true);

-- Reads are not granted by RLS - reports are read via the service role
-- (you, via the Supabase dashboard, or via a future admin endpoint).

create index if not exists idx_bug_reports_created_at
  on public.bug_reports(created_at desc);
