-- ============================================================
-- Capi: make the API the only writer (the real anti-cheat step)
--
-- PREREQUISITE, DO NOT SKIP: the web app must already be deployed with
-- SUPABASE_SERVICE_ROLE_KEY set in Vercel (Project > Settings >
-- Environment Variables, server-only, NOT prefixed NEXT_PUBLIC_). The API
-- routes prefer that key (apps/web/src/lib/supabase/server.ts). If this
-- file runs before that variable exists, every create/join/move/chat call
-- fails, because the publishable key would no longer be allowed to write.
--
-- Verify before running: POST https://playcapi.com/api/games with
-- {"nickname":"Probe"} must succeed AFTER the env var is set and a deploy
-- has completed.
--
-- What this changes: the publishable (anon) key can still read games and
-- players (the clients need that for realtime and invite links) but can no
-- longer insert or update game rows, seat rows, move logs, chat logs, or
-- bug reports directly. Clients never wrote directly, so nothing in the
-- apps breaks; only devtools cheating does.
-- ============================================================

drop policy if exists "games: public update" on public.games;
drop policy if exists "games: public insert" on public.games;
drop policy if exists "players: public insert" on public.players;
drop policy if exists "moves: public insert" on public.moves;
drop policy if exists "chat_emotes: public insert" on public.chat_emotes;
drop policy if exists "bug_reports: public insert" on public.bug_reports;
revoke insert on public.bug_reports from anon, authenticated;
