-- ============================================================
-- Capi — Dominican Dominoes  |  Initial Schema
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ── games ────────────────────────────────────────────────────
create table if not exists public.games (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  invite_code     text not null unique,
  mode            text not null check (mode in ('live','turn_based')) default 'turn_based',
  theme           text not null check (theme in ('barberia','colmado','patio')) default 'barberia',
  status          text not null check (status in ('waiting','playing','round_over','finished')) default 'waiting',
  state_version   integer not null default 0,
  game_state      jsonb,
  settings        jsonb not null default '{"targetScore":100,"is2v2":false}'::jsonb
);

alter table public.games enable row level security;

-- Anyone can read any game (needed to join via invite code)
create policy "games: public read"
  on public.games for select
  using (true);

-- Anyone can create a game
create policy "games: public insert"
  on public.games for insert
  with check (true);

-- Anyone can update a game (state_version check happens in app logic)
create policy "games: public update"
  on public.games for update
  using (true);


-- ── players ──────────────────────────────────────────────────
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  game_id      uuid not null references public.games(id) on delete cascade,
  seat         text not null check (seat in ('n','e','s','w')),
  nickname     text not null,
  avatar_color text not null default '#6366f1',
  unique (game_id, seat)
);

alter table public.players enable row level security;

create policy "players: public read"
  on public.players for select
  using (true);

create policy "players: public insert"
  on public.players for insert
  with check (true);


-- ── moves ────────────────────────────────────────────────────
create table if not exists public.moves (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  game_id     uuid not null references public.games(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  round_index integer not null default 0,
  intent      jsonb not null,
  result      jsonb
);

alter table public.moves enable row level security;

create policy "moves: public read"
  on public.moves for select
  using (true);

create policy "moves: public insert"
  on public.moves for insert
  with check (true);


-- ── indexes ──────────────────────────────────────────────────
create index if not exists idx_games_invite_code on public.games(invite_code);
create index if not exists idx_players_game_id   on public.players(game_id);
create index if not exists idx_moves_game_id     on public.moves(game_id);
