# Capi Mobile: Expo Port + Store Readiness — Design

**Date:** 2026-06-10
**Status:** Approved (pending spec review)
**Goal targets:** iOS App Store, Google Play Store, iMessage extension (GamePigeon-style)

## 1. Context

Capi is a Dominican dominoes game: a Next.js 14 web app (playcapi.com) backed by
Supabase (Postgres + Realtime), with a pure-TypeScript server-authoritative game
engine (`src/lib/engine/`: types, reducer, validate, scoring — 93 passing tests)
and a pure board-layout module (`boardLayout.ts`). The web app is polished and
correct after an extensive audit/fix cycle (Dominican rules: DOMINÓ, CAPICÚA,
mid-round VEINTICINCO with stacking, reachable TRANCAO; overlap-proof snake
layout; verified live in 1v1 and 2v2).

The next phase ships native apps to both stores and, after that, an iMessage
game. Decision made: **React Native via Expo**, one codebase for both stores,
reusing the TypeScript engine verbatim.

## 2. Decisions (made with the owner)

| Decision | Choice |
|---|---|
| Cross-platform approach | Expo (managed) React Native rewrite of the UI |
| Code sharing | npm-workspaces monorepo with a shared engine package |
| Backend | Reuse the existing deployed API (playcapi.com routes) + Supabase Realtime; mobile is another client of the same games |
| First milestone | Vertical slice (1v1 core loop, one theme) on a real device, then parity, then store packaging |
| iMessage | Separate native target, built after the stores track; reuses the same engine |

## 3. Monorepo structure

```
capi/
├── packages/
│   └── engine/             # @capi/engine — pure TS, zero runtime deps
│       ├── src/            # types.ts, reducer.ts, validate.ts, scoring.ts,
│       │                   # boardLayout.ts (pure snake math)
│       └── __tests__/      # the 93 engine + layout tests move here
├── apps/
│   ├── web/                # the current Next.js app, moved from repo root
│   └── mobile/             # new Expo app
└── package.json            # workspaces root
```

- `@capi/engine` is the single source of truth for rules and board geometry.
  Web, mobile, and (later) iMessage import it. Rules can never drift.
- The i18n strings move to a second tiny package, `packages/i18n`
  (`@capi/i18n`), since both UIs need them but they are not game rules. The
  React context wrapper stays per-app; only the string tables are shared.

### Step 0 risk gate (the repo move)

Moving the Next.js app to `apps/web/` is the riskiest mechanical step. It is
its own commit, verified before anything mobile starts:

1. All 93 tests pass from the new package location.
2. `apps/web` builds (`next build`) clean.
3. Vercel project root updated to `apps/web`; production deploy verified
   (site loads, a live game works).

Fallback if Vercel or imports fight back: keep the web app at the repo root
and share the engine via a workspace package only (looser layout, same
guarantee of a single engine).

## 4. Mobile app stack

- **Expo (managed workflow)** + **Expo Router** (file-based routing, mirrors
  the Next.js mental model).
- **NativeWind** for styling — the Tailwind classes and theme tokens carry
  over with minimal translation.
- **react-native-svg** — TileDisplay pips (incl. the drilled-pip radial
  gradient) and the mode glyphs port directly.
- **@supabase/supabase-js** — works in RN for Realtime subscriptions; REST
  calls go to the deployed playcapi.com API.
- **EAS Build/Submit** — added at the store-ready milestone, not during the
  slice.

## 5. What ports verbatim vs. what is rebuilt

**Verbatim (pure logic, zero changes):**
- Engine: types, reducer, validate, scoring.
- `boardLayout.ts`: the snake S-curve, content-aware row spacing, both tile
  dimension tiers, no-overlap guarantees (tests included).
- i18n strings (EN / Dominican ES).
- Move-intent and API request/response shapes.

**Ported with light changes:**
- `useRealtimeGame` hook — fetch + Supabase logic identical; storage moves
  from `localStorage` to `AsyncStorage`; base URL becomes configurable
  (env: dev `localhost`, prod `https://playcapi.com`).

**Rebuilt as RN components (same visual design):**
- `TileDisplay`, `Board` (ScrollView + absolutely-positioned tiles driven by
  `layoutBoard`), `Hand`, `ScorePanel`, `CalloutOverlay`, the VEINTICINCO
  banner, game screen, create/join screens, waiting room.
- Sounds via `expo-av`; haptics (`expo-haptics`) on slam/callout as a native
  bonus.

## 6. Milestones

### M1 — Vertical slice (the proving milestone)
Create/join → 1v1 game vs a web player → board + hand render → tap tile,
choose end, play/pass/draw → callouts + mid-round banner → round over → next
round → game over. One theme (barbería). Runs on a real device (Expo Go or
dev build) against the production backend. Cross-platform game (mobile vs
web browser) explicitly verified.

**Exit criteria:** a full 1v1 game playable phone-vs-laptop with no rule or
sync divergence; board renders the snake correctly at phone width; 93 engine
tests still pass from the shared package; web app unaffected in production.

### M2 — Parity
2v2 (side rails, partner labels), all three themes, quick chat + emotes,
sounds + haptics, ES/EN toggle, rematch, bug-report hook-up, reduced-motion
respect (RN `AccessibilityInfo`).

### M3 — Store readiness
App icons/splash, EAS build profiles, store metadata (names, screenshots,
privacy), TestFlight + Play internal track, crash reporting (Sentry RN —
matches the web's Sentry), store review-guideline pass (Apple 4.2 minimum
functionality is satisfied by native UI + haptics + full game).

### M4 — iMessage extension (own spec later)
GamePigeon-style: an iMessage App Extension where each turn is an
`MSMessage` bubble carrying encoded game state; asynchronous turn-by-turn,
no live server required. Reuses `@capi/engine` (via JavaScriptCore bridge or
a small Swift port — decided in its own design doc). Out of scope for this
spec beyond the constraint it imposes: **the engine package stays pure and
dependency-free so it can be embedded anywhere.**

## 7. Data flow (mobile, M1)

Identical to web by construction:

1. Screen action → `submitMove(intent)` → POST
   `https://playcapi.com/api/games/[id]/move` with `stateVersion` optimistic
   lock.
2. Supabase Realtime `postgres_changes` on `games` row → new `game_state` →
   re-render. Version-keyed callout dismissal as on web.
3. Session (`playerId`, `seat`, `gameId`) in AsyncStorage keyed by game id.

Error handling, in-flight guards, and 409 semantics are ports of the
already-hardened web hook.

## 8. Testing

- Engine + layout tests run in the workspace (`npm test` at root runs all
  packages). No mobile-specific engine tests needed — same code.
- M1 verification is live, on-device/simulator: scripted opponents via the
  public API (the existing capi-bot pattern) + manual phone play, mirroring
  how the web app was verified this cycle.
- Component-level RN tests are NOT required for M1 (the logic under test
  lives in the engine); revisit at M2 if regressions appear.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Repo move breaks Vercel deploy | Step-0 gate with explicit production verification; fallback layout documented above |
| RN board performance (many absolutely-positioned views) | Board is ≤28 tiles — trivial view count; if needed, flatten with `react-native-svg` rendering |
| Supabase Realtime flakiness on mobile networks | Same recovery paths as web (refetch on stale/409); add foreground-resume refetch (`AppState` listener) |
| Apple "minimum functionality" rejection (4.2) for thin apps | Full native UI (not a webview), haptics, sounds — comfortably above the bar |
| Engine import paths break web during restructure | Single-commit move + full test/build/deploy verification before mobile work begins |

## 10. Out of scope (this spec)

- iMessage extension internals (own spec at M4).
- Accounts/auth, push notifications, matchmaking, ranked play.
- Web UI changes (the web app stays as-is, just relocated).
- Monetization/IAP.
