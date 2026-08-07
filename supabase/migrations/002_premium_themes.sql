-- ============================================================
-- Capi 1.1 (M5): premium table themes
-- Run this entire file in the Supabase SQL Editor.
-- Widens the games.theme check so premium mesas can be created
-- (quisqueya, larimar, noche). Without this, POST /api/games
-- with a premium theme returns 500.
-- ============================================================

alter table public.games
  drop constraint games_theme_check;

alter table public.games
  add constraint games_theme_check
  check (theme in ('barberia','colmado','patio','quisqueya','larimar','noche'));

-- Self-test: succeeds only if the new constraint is live, then cleans up.
insert into public.games (invite_code, theme) values ('M5TEST', 'larimar');
delete from public.games where invite_code = 'M5TEST';
