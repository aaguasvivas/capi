# CAPI

Dominican dominoes online: 1v1 or 2v2, real-time multiplayer. Live at https://playcapi.com and as an iOS/Android app.

## Layout (monorepo, npm workspaces)
- `apps/web` (Next.js, deployed to Vercel) and `apps/mobile` (Expo)
- `apps/mobile` holds its own `app.json` and `eas.json`; run every expo/eas command from `apps/mobile` under Node 20, never from the repo root
- `packages/engine` (pure TS game rules + board layout) and `packages/i18n` (shared strings in src/strings.ts)
- `supabase/` (backend: db, auth, realtime)

## Commands
- Web dev: `npm run dev:web`
- Web build: `npm run build:web`
- Mobile: `npm run start:mobile`
- Tests: `npm test` (engine suite incl. fuzz invariants) and `npx vitest run` in apps/web (embed session suite)

## Languages
EN/ES with Dominican flavor. Shared strings live only in packages/i18n; do not hardcode strings in apps.

## Rules
- No em dashes in user-facing text.
- Real-time logic changes need testing with two clients, not one.
- Engine changes: `npm test` includes an invariant fuzz suite (packages/engine/__tests__/invariants.fuzz.test.ts) that plays full seeded games and checks tile conservation, scoring math, turn order, and determinism after every move. A failure prints the seed; reproduce with that exact seed.
