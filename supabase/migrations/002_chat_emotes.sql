-- ============================================================
-- Capi — Dominican Dominoes  |  Chat & Emotes
-- ============================================================

create table if not exists public.chat_emotes (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id    uuid        not null references public.games(id) on delete cascade,
  player_id  uuid        not null references public.players(id) on delete cascade,
  type       text        not null check (type in ('quick_chat', 'emote')),
  payload    text        not null
);

alter table public.chat_emotes enable row level security;

create policy "chat_emotes: public read"
  on public.chat_emotes for select
  using (true);

create policy "chat_emotes: public insert"
  on public.chat_emotes for insert
  with check (true);

create index if not exists idx_chat_emotes_game_id on public.chat_emotes(game_id);
