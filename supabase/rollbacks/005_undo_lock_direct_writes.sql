-- ============================================================
-- Undo for 005_lock_direct_writes.sql. Run ONLY if games stop working
-- right after 005 (creating, joining or moving fails). That means the
-- server is still running without SUPABASE_SERVICE_ROLE_KEY. This puts the
-- write policies from 001, 002 and 003 back, so the publishable key can
-- write again. Fix the Vercel variable and redeploy, then run 005 again.
-- Safe to run more than once.
-- ============================================================

drop policy if exists "games: public insert" on public.games;
create policy "games: public insert" on public.games for insert with check (true);

drop policy if exists "games: public update" on public.games;
create policy "games: public update" on public.games for update using (true);

drop policy if exists "players: public insert" on public.players;
create policy "players: public insert" on public.players for insert with check (true);

drop policy if exists "moves: public insert" on public.moves;
create policy "moves: public insert" on public.moves for insert with check (true);

drop policy if exists "chat_emotes: public insert" on public.chat_emotes;
create policy "chat_emotes: public insert" on public.chat_emotes for insert with check (true);

grant insert on public.bug_reports to anon, authenticated;
drop policy if exists "bug_reports: public insert" on public.bug_reports;
create policy "bug_reports: public insert" on public.bug_reports for insert to anon, authenticated with check (true);
