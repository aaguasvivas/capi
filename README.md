# Capi 🁣

**Dominican Dominoes, online.** Play 1v1 or 2v2 (Con tu frente) with real-time multiplayer, authentic rules, and full Dominican flavor.

---

## What is Capi?

Capi is a web-first Dominican dominoes game built for the culture. No account needed — pick a name, share a link, and run it. The rules are authentic: DOMINÓ, CAPICÚA, TRANCAO, VEINTICINCO. The feel is right: barbería, colmado, or patio. English or Dominican Spanish, your call.

## Features

- **1v1 and 2v2 (Con tu frente)** — Play head-to-head or with a partner across from you (N-S vs E-W)
- **Real-time multiplayer** — Powered by Supabase Realtime, moves sync instantly across all players
- **Authentic Dominican rules** — DOMINÓ, CAPICÚA (+25 bonus), TRANCAO (4 consecutive passes in 2v2), VEINTICINCO (3 passes after your play)
- **3 table themes** — Barbería Don Ramón, Colmado La Esquina, El Patio de Tía
- **Target score** — Play to 100 or 200 points
- **Quick Chat + Emotes** — ¡Dale!, ¡Eso e'!, ¡Qué lo qué!, 🔥, 💀 and more
- **Sound design** — Authentic domino slam sound, callout audio
- **Language toggle** — NY English and Dominican Spanish
- **No sign-up** — Session stored locally, share a link to invite

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase (Postgres + Realtime) |
| Styling | Tailwind CSS |
| Game Engine | Pure TypeScript reducer (zero dependencies) |
| Tests | Vitest (62 tests) |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/capi.git
   cd capi
   npm install
   ```

2. **Set up environment variables**

   Create `.env.local` at the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the database migrations**

   In your Supabase project → SQL Editor, run these files in order:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_chat_emotes.sql`

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Running Tests

```bash
npm test
```

62 tests covering the game engine: turn order, scoring (DOMINÓ, CAPICÚA, TRANCAO, VEINTICINCO), 1v1 and 2v2 rules, edge cases.

## How to Play

1. One player creates a game, picks a theme and mode (1v1 or 2v2)
2. Share the invite link with your opponent(s)
3. Once all players join, the game starts automatically
4. The player with the highest double goes first
5. First team to reach the target score wins

### Dominican Rules

- **DOMINÓ** — Play your last tile and win the round. Score = opponent's total pips.
- **CAPICÚA** — Win with a tile that matches both open ends of the board. +25 bonus.
- **TRANCAO** — All players pass with no legal moves. Team with fewer pips wins.
- **VEINTICINCO** — You play, then all other players pass before your turn returns. Your team gets 25 + opponent pips.

## Project Structure

```
src/
├── app/
│   ├── api/games/          # REST API routes (create, join, move, next-round, rematch)
│   ├── game/[id]/          # Game page
│   └── page.tsx            # Landing page
├── components/
│   ├── game/               # Board, Hand, ScorePanel, CalloutOverlay, QuickChat, TileDisplay
│   ├── CreateGameForm.tsx
│   └── JoinGameForm.tsx
├── hooks/
│   └── useRealtimeGame.ts  # Supabase Realtime subscription + game state
├── lib/
│   ├── engine/             # Pure TS game engine (types, reducer, validate, scoring)
│   ├── i18n/               # Language system (EN/ES strings + context)
│   └── supabase/           # Supabase client helpers
__tests__/
└── engine/                 # Vitest unit tests for the game engine
```

## License

MIT
