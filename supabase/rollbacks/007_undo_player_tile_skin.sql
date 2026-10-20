-- ============================================================
-- Undo for 007_player_tile_skin.sql. Without the column, 1.2 players with
-- a premium tile design cannot create or join a game (the API adds
-- tile_skin to their insert, which then fails with HTTP 500). Never run
-- this once 1.2 is in review or live. Safe to run more than once.
-- ============================================================

alter table public.players
  drop constraint if exists players_tile_skin_check;

alter table public.players
  drop column if exists tile_skin;
