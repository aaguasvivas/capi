-- ============================================================
-- Capi: realtime publication, made reproducible
-- Safe to run any time (idempotent). Run in the Supabase SQL Editor.
-- The clients subscribe to postgres_changes on games (UPDATE) and
-- players (INSERT). Until now that was switched on by hand in the
-- dashboard; a rebuilt project would have working REST and dead
-- realtime. This records it in the schema.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
