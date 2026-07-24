# Capi - Playbook (app #2)

> The durable context + checklist for shipping and maintaining Capi.
> If you're an AI assistant picking this up cold: read this file first, then `docs/RELEASE.md` for the submission runbook and `docs/store-listing.md` for the listing copy.

---

## What Capi is

**Capi is a real online multiplayer Dominican dominoes game.** Web + mobile: play in the browser at https://playcapi.com or in the app, and both clients talk to the same server (Next.js API on Vercel + Supabase database/realtime). App users and browser users sit at the same table.

**Capi is app #2** in the app factory. **Anota (app #1) is its sibling, not its competitor:** Anota keeps score when your people are around a physical table; Capi *is* the table when they are not. A cross-promo between the two is natural (Anota → "playing remote? get Capi"; Capi → "playing in person? get Anota"), but v1 store copy stays clean; wire cross-promo later in-app or on the websites.

The big architectural difference from Anota: Anota is local-first with no backend; **Capi is server-authoritative**. Every move is validated on the server before it is applied, so no client can cheat. Clients render state; the engine decides.

### Principles

1. **Quality is non-negotiable.** Tasteful UI, real haptics, no jank, no broken layouts on any device.
2. **The rules must be the real rules.** Capicúa bonus, paso, tranque decided by pip count, 25 points for making every opponent pass, all table pips to the round winner. A Dominican player must nod, not squint.
3. **Server-authoritative, always.** Never trust a client with game state transitions. The engine lives in `packages/engine` and runs on the server.
4. **No accounts.** Nickname + avatar color + a 6-letter invite code. Friction kills a game night.
5. **Bilingual ES/EN with an authentic Dominican voice.** Parity enforced by TypeScript in `packages/i18n`.
6. **Pinned stack discipline.** The mobile stack is frozen (see below). A version bump is a decision, never a side effect.

---

## Monorepo layout (npm workspaces)

```
capi/
├── packages/engine    # Pure TS rules + board layout. No RN, no React. Heavily unit-tested.
├── packages/i18n      # Typed ES/EN dictionaries (Strings interface = parity by compiler).
├── apps/web           # Next.js 14 (app router) on Vercel. API routes + web client + Supabase.
├── apps/mobile        # Expo SDK 52 + expo-router. Talks to the same API + Supabase realtime.
└── supabase/          # SQL migrations.
```

- **Engine tests are the safety net:** root `npm test` runs 99 tests (vitest), including a board-layout never-overlap property suite that replays 200 random legal games and asserts no two tiles ever overlap at any width or tier.
- Game state is a single `GameState` JSON blob in Postgres with `state_version` optimistic concurrency; Supabase Realtime pushes updates; quick chat rides a Broadcast channel.

---

## PINNED mobile stack (never bump without explicit approval)

- **Expo SDK 52.** Not 53, not 56.
- **React 18.3.1 exactly**, hoisted identical with `apps/web`. SDK 56 / React 19 broke the web build once; the monorepo hoists one React and both apps must agree.
- **NativeWind 4 + Tailwind 3** (not Tailwind 4).
- `react-native-svg`, `expo-av` (sounds), `expo-linear-gradient`, `@react-native-async-storage/async-storage`, `expo-haptics`, `expo-router`.
- **Node 20 for everything Expo/EAS**, and always from `apps/mobile`, never the repo root:

```bash
cd apps/mobile && source ~/.nvm/nvm.sh && nvm use 20
```

If a dependency change is truly needed, it gets its own branchless commit on main with all four verification gates green, and the pin list here gets updated in the same commit.

---

## How mobile talks to the backend

- `apps/mobile/theme.ts` exports `API_BASE`: `EXPO_PUBLIC_API_BASE` if set, else `https://playcapi.com`. Production builds need no extra config for the API.
- REST for create / join / move / rematch (`/api/games/...`), Supabase Realtime for live game state, Supabase Broadcast for quick chat. Session (playerId, seat, gameId) persists in AsyncStorage.
- Supabase public env values (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) live in the gitignored `apps/mobile/.env` locally and in **EAS env vars** per profile (development / preview / production) for builds. They stay out of git.

---

## Verification gates (run before calling anything done)

1. Root: `npm test` - 99 engine tests pass.
2. Web: `cd apps/web && npx next build` - **never while a dev server is running.**
3. Mobile types: `cd apps/mobile && npx tsc --noEmit`.
4. Mobile bundle: `cd apps/mobile && npx expo export --platform ios`.

All four green or it is not done.

---

## v1 feature truth (what any copy may claim)

The listing, review notes, and marketing may claim exactly this and nothing more:

- Authentic Dominican rules: capicúa bonus (+25), paso, tranque decided by pip count, 25 points when you make every opponent pass, and when someone dominates the round every pip left on the table counts for the winner.
- 1v1 and 2v2 en parejas (con tu frente). In 1v1 there is a boneyard draw; in 2v2 all 28 tiles are dealt.
- Create a game and share a 6-letter invite code. No account, no sign-up.
- Three table themes: Barbería, Colmado, Patio, each with a Dominican watermark.
- Quick chat with Dominican phrases + emotes. **Predefined only, no free text.** The only free text a user ever enters is their nickname.
- Tile slam sounds and haptics, with a persisted mute.
- Fully bilingual Spanish / English.
- Cross-play with the web at playcapi.com.

**Never claim:** AI opponents, solo play, matchmaking, free-text chat, or offline play. Capi needs the internet and real friends. If a claim is not in the list above, it does not go in copy.

---

## Store identity

- Bundle id / package: `dev.capi.app` (iOS + Android).
- Expo owner: `aaguasvivas` (project `@aaguasvivas/capi`).
- EAS profiles: `development` / `preview` / `production`, `appVersionSource: remote`, production `autoIncrement: true`.
- `submit.production.ios.ascAppId` gets added to `apps/mobile/eas.json` after the App Store Connect record exists (Anota's pattern).
- URLs: marketing https://playcapi.com · privacy https://playcapi.com/privacy · support https://playcapi.com/support

---

## Privacy truth (Capi is NOT "no data")

Anota's "collects no data" story does not apply here; Capi has a server. The honest story, everywhere it is asked:

- No accounts, no sign-in. Players pick a nickname per game.
- The server stores: nickname, avatar color, game moves/scores, and quick-chat selections (predefined phrases). Games are identified by random codes; nothing is linked to a real identity.
- Optional bug reports include the game state plus basic device info to reproduce issues.
- App Store nutrition label: **"Data Not Linked to You"** with **Name** (nickname) and **User Content** (gameplay, optional bug reports).
- Play Data Safety: data collected (app activity, name), **not linked to identity, not shared, not sold.**
- No ads, no analytics SDKs on mobile, no tracking, no ATT prompt needed.

---

## Monetization plan

**v1: FREE, no ads, no IAP.** Same easy-mode rationale as Anota: simplest submission, no ad SDK, no ATT, clean privacy story.

**Later (v1.1+), only if it never wrecks the feel:** nothing mid-game, ever. Candidates: a cheap one-time cosmetic unlock (more table themes), or a banner strictly on calm surfaces (home screen, never the table). Adding ads changes the privacy answers; re-do the labels then.

---

## Current status

- Milestones M1 (mobile vertical slice) and M2 (parity + board feel) are done; M3 (store readiness: identity, EAS pipeline, icon/splash, privacy + support pages, these docs, first iOS build) is this batch.
- Remaining before the store: App Store screenshots (6.7", staged games), `ascAppId` after the ASC record exists, a TestFlight install pass on a real phone, Google Play account confirmation. Details in `docs/RELEASE.md`.

---

## Process notes (how we work)

- Brainstorm/design → spec → plan → implement task-by-task → verify (all four gates) → merge to `main` → push. Specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
- Solo dev: everything lands on `main` and pushes to GitHub.
- Engine logic stays pure and unit-tested; UI is verified by exporting the real bundle, not just `tsc`.
- All user-facing copy, both languages: **no em dashes.** Commas, periods, or restructure.
