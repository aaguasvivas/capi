-- ============================================================
-- Undo for 007_player_tile_skin.sql. Run ONLY after the web deploy that
-- writes players.tile_skin is rolled back, or creating and joining games
-- fails for every client. Safe to run more than once.
-- ============================================================

alter table public.players
  drop constraint if exists players_tile_skin_check;

alter table public.players
  drop column if exists tile_skin;
