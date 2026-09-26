-- Capi 006: web tables created before the 1.1 polish pass become "live".
--
-- Until 2026-09-26 the web create form sent no mode, so its tables took the
-- column default 'turn_based'. Since the polish pass, a turn-based table can
-- never be claimed (the iMessage extension creates those on purpose), so the
-- older web tables, and every rematch chained from them, lost the claim.
-- The web form now sends 'live'. This one-off update gives the older tables
-- back their claim. It also touches the few turn-based tables that TestFlight
-- builds of the extension made before the cutoff; that is harmless.
--
-- Optional, idempotent, safe to run any time. Run it in the Supabase SQL
-- Editor. It changes no schema.

update public.games
set
  mode = 'live',
  game_state = case
    when game_state is null then null
    else jsonb_set(game_state, '{mode}', '"live"')
  end
where mode = 'turn_based'
  and created_at < timestamptz '2026-09-26 12:00:00+00';

-- Check: returns 0 once applied.
select count(*) as older_turn_based_tables
from public.games
where mode = 'turn_based'
  and created_at < timestamptz '2026-09-26 12:00:00+00';
