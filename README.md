# Capi 🁣

**Dominican Dominoes, online.** Play 1v1 or 2v2 (con tu frente) in the browser at [playcapi.com](https://playcapi.com) or in the Capi app for iOS and Android. Real-time multiplayer, authentic rules, full Dominican flavor.

## What is Capi?

Capi is the Dominican dominoes game you grew up with, built for the culture. No account needed: pick a name, share a 6-letter code, and run it. The rules are authentic (DOMINÓ, CAPICÚA, TRANQUE, VEINTICINCO), the tables feel right (barbería, colmado, patio), and every seat is a real person. English or Dominican Spanish, your call.

## Features

- **1v1 and 2v2 (con tu frente)**: head-to-head, or partners across the table (N-S vs E-W)
- **Real-time multiplayer**: Supabase Realtime syncs moves instantly; app and browser players share the same table
- **Authentic Dominican rules**, validated server-side so nobody can cheat
- **3 table themes**: Barbería Don Ramón, Colmado La Esquina, El Patio de Tía
- **Target score**: first to 100 or 200
- **Quick chat + emotes**: ¡Dale!, ¡Eso e'!, ¡Qué lo qué!, 🔥, 💀 and more (predefined phrases only)
- **Sound + haptics**: the tile slam you know, with a mute the table will thank you for
- **Bilingual**: English and Dominican Spanish
- **No sign-up**: session stored locally, share a code or link to invite

## The rules, as played

- **DOMINÓ**: play your last tile to win the round. Every pip still on the table counts for you, opponents and your own partner included.
- **CAPICÚA**: close the round with a tile that matches both open ends. +25 bonus.
- **TRANQUE**: the table locks with no legal moves. The side with fewer pips in hand wins the round.
- **VEINTICINCO**: you play and every other player passes before your turn comes back. +25 on the spot, and the round keeps going. It stacks if you do it again.

## Monorepo

| Path | What it is |
|---|---|
| `apps/web` | Next.js 14 site + API at playcapi.com (Vercel) |
| `apps/mobile` | Expo app (SDK 52, React 18.3.1 pinned) for iOS and Android |
| `packages/engine` | Pure TypeScript rules engine + board layout, zero dependencies |
| `packages/i18n` | Typed ES/EN string dictionaries shared by both apps |
| `docs/` | Release playbook, runbook, and store listing kit |

The engine carries the test suite (99 Vitest tests), including a property suite that plays hundreds of random legal games per run to prove board tiles can never overlap at any screen width.

## Getting started

Prerequisites: Node 20 (`nvm use 20`), a [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/aaguasvivas/capi.git
cd capi
npm install
```

Environment: create `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `apps/mobile/.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Run the SQL files in `supabase/migrations/` in order in your Supabase SQL editor.

```bash
npm test                                 # engine suite, from the repo root
cd apps/web && npm run dev               # web at http://localhost:3000
cd apps/mobile && npx expo start         # mobile via Expo Go (Node 20 required)
```

## Shipping

Store identity, EAS build profiles, and the submission runbook live in [docs/RELEASE.md](docs/RELEASE.md) and [docs/PLAYBOOK.md](docs/PLAYBOOK.md). Store copy (EN + ES) is in [docs/store-listing.md](docs/store-listing.md).

## License

MIT
