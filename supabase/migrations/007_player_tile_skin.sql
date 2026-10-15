-- ============================================================
-- Capi 1.2: each seat keeps the player's premium tile design
-- Run this entire file in the Supabase SQL Editor, BEFORE the web
-- deploy that writes the column.
-- The other players draw this seat's face-down tiles (backs) in this
-- design. Null means no premium design: each viewer then uses their own.
-- Only the API writes it (005 removed public writes). Older apps and the
-- 1.1 extension never send it, so their seats stay null.
-- Safe to run more than once.
-- ============================================================

alter table public.players
  add column if not exists tile_skin text;

alter table public.players
  drop constraint if exists players_tile_skin_check;

alter table public.players
  add constraint players_tile_skin_check
  check (tile_skin is null or tile_skin in ('quisqueya','borinquen','kingston'));

-- Check: this returns one row (tile_skin, text, YES) when the column is live.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'players' and column_name = 'tile_skin';
