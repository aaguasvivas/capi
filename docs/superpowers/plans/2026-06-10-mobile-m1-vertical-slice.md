# Capi Mobile M1 — Monorepo + 1v1 Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into an npm-workspaces monorepo with a shared `@capi/engine` package, then build an Expo (React Native) app that plays a full 1v1 Dominican dominoes game against the existing live backend — verified on a device/simulator against a web player.

**Architecture:** One canonical pure-TS engine package consumed by both `apps/web` (current Next.js app, relocated) and `apps/mobile` (new Expo app). Mobile is a new *client* of the already-deployed playcapi.com API + Supabase Realtime — no backend changes. The hard-won game logic and board geometry port verbatim; only React presentation is rebuilt in RN.

**Tech Stack:** npm workspaces, TypeScript, Vitest (engine tests), Next.js 14 (web, unchanged behavior), Expo + Expo Router + NativeWind + react-native-svg + @supabase/supabase-js + AsyncStorage (mobile).

**Reference (do not delete during the port — they are the source of truth for the RN rebuild):** the current web components under `apps/web/src/components/game/` after relocation: `Board.tsx`, `Hand.tsx`, `TileDisplay.tsx`, `ScorePanel.tsx`, `CalloutOverlay.tsx`, `apps/web/src/app/game/[id]/page.tsx`, `apps/web/src/hooks/useRealtimeGame.ts`.

---

## Phase A — Monorepo restructure + engine extraction (HIGH RISK, gated)

This phase changes no behavior. Exit gate: web app builds, all 93 tests pass, production Vercel deploy verified. **Do not start Phase B until the gate passes.**

### Task A1: Create the workspace root and engine package skeleton

**Files:**
- Create: `package.json` (new workspace root — replaces current root package.json)
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Modify: move current root `package.json` → `apps/web/package.json` (Task A3)

- [ ] **Step 1: Snapshot current green state**

Run: `npm test`
Expected: `Tests 93 passed (93)`. If not 93, STOP — fix before restructuring.

- [ ] **Step 2: Create the engine package directory and move engine source**

```bash
mkdir -p packages/engine/src packages/engine/__tests__
git mv src/lib/engine/types.ts packages/engine/src/types.ts
git mv src/lib/engine/reducer.ts packages/engine/src/reducer.ts
git mv src/lib/engine/validate.ts packages/engine/src/validate.ts
git mv src/lib/engine/scoring.ts packages/engine/src/scoring.ts
git mv src/lib/engine/index.ts packages/engine/src/index.ts
git mv src/components/game/boardLayout.ts packages/engine/src/boardLayout.ts
```

- [ ] **Step 3: Add `boardLayout` to the engine barrel export**

Edit `packages/engine/src/index.ts` to (append):

```typescript
export * from "./reducer";
export * from "./boardLayout";
```

(Keep the existing `export * from "./types"`, `"./validate"`, `"./scoring"` lines. The file should export all five modules.)

- [ ] **Step 4: Fix the one aliased import inside boardLayout**

`packages/engine/src/boardLayout.ts` line 1 currently reads:
```typescript
import type { Tile } from "@/lib/engine/types";
```
Change to:
```typescript
import type { Tile } from "./types";
```

- [ ] **Step 5: Create `packages/engine/package.json`**

```json
{
  "name": "@capi/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 6: Create `packages/engine/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "__tests__/**/*.ts"]
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Extract pure engine + board layout into packages/engine"
```

### Task A2: Move engine tests into the package and re-point imports

**Files:**
- Move: `__tests__/engine/*.test.ts` → `packages/engine/__tests__/`
- Move: `__tests__/components/boardLayout.test.ts` → `packages/engine/__tests__/boardLayout.test.ts`
- Create: `packages/engine/vitest.config.ts`

- [ ] **Step 1: Move the test files**

```bash
git mv __tests__/engine/reducer.test.ts packages/engine/__tests__/reducer.test.ts
git mv __tests__/engine/scoring.test.ts packages/engine/__tests__/scoring.test.ts
git mv __tests__/engine/validate.test.ts packages/engine/__tests__/validate.test.ts
git mv __tests__/components/boardLayout.test.ts packages/engine/__tests__/boardLayout.test.ts
```

- [ ] **Step 2: Re-point engine test imports**

In `packages/engine/__tests__/reducer.test.ts`, `scoring.test.ts`, `validate.test.ts`: replace every `@/lib/engine/reducer`, `@/lib/engine/types`, `@/lib/engine/scoring`, `@/lib/engine/validate` with the relative path `../src/<module>` (e.g. `@/lib/engine/reducer` → `../src/reducer`).

In `packages/engine/__tests__/boardLayout.test.ts`: replace `@/components/game/boardLayout` → `../src/boardLayout` and `@/lib/engine/types` → `../src/types`.

- [ ] **Step 3: Create the engine vitest config**

`packages/engine/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    css: false,
  },
});
```

- [ ] **Step 4: Add a test script to the engine package**

Add to `packages/engine/package.json` a `"scripts"` block:
```json
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.6"
  }
```
(Merge into the existing JSON object from Task A1 Step 5 — do not create a second top-level object.)

- [ ] **Step 5: Commit (tests will run after workspace install in A4)**

```bash
git add -A
git commit -m "Move engine + layout tests into packages/engine"
```

### Task A3: Relocate the Next.js app to apps/web

**Files:**
- Move: nearly all current root app files into `apps/web/`
- Modify: `apps/web/package.json` (renamed, add engine dep)

- [ ] **Step 1: Create apps/web and move the web app into it**

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv public apps/web/public
git mv next.config.js apps/web/next.config.js
git mv next-env.d.ts apps/web/next-env.d.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv tailwind.config.ts apps/web/tailwind.config.ts
git mv postcss.config.js apps/web/postcss.config.js
git mv instrumentation.ts apps/web/instrumentation.ts
git mv sentry.client.config.ts apps/web/sentry.client.config.ts
git mv sentry.edge.config.ts apps/web/sentry.edge.config.ts
git mv sentry.server.config.ts apps/web/sentry.server.config.ts
git mv vitest.config.ts apps/web/vitest.config.ts
git mv package.json apps/web/package.json
git mv package-lock.json apps/web/package-lock.json
```

Note: `supabase/` (migrations), `docs/`, `README.md`, `.gitignore`, `.nvmrc`, `.env.local` stay at the repo root. `__tests__/` is now empty (engine tests moved) — remove it: `rmdir __tests__/engine __tests__/components __tests__ 2>/dev/null || true`.

- [ ] **Step 2: Rename the web package and add the engine dependency**

In `apps/web/package.json`: change `"name": "capi"` → `"name": "@capi/web"`. Add to `dependencies`:
```json
    "@capi/engine": "*",
```
Remove the now-misplaced root `"test"` script's reliance on the old test dir — the web `package.json` keeps `"test": "vitest run"` (it will find no tests now; that's fine, engine tests live in the engine package). Leave other scripts (`dev`, `build`, `start`, `lint`) unchanged.

- [ ] **Step 3: Re-point web imports of the engine + boardLayout**

The engine and `boardLayout` moved out of `apps/web/src`. Update these files (all under `apps/web/`):

- `src/app/game/[id]/page.tsx`: `@/lib/engine/types` → `@capi/engine`
- `src/app/api/games/route.ts`: `@/lib/engine/reducer` (and any engine import) → `@capi/engine`
- `src/app/api/games/[id]/move/route.ts`: engine imports → `@capi/engine`
- `src/app/api/games/[id]/join/route.ts`: engine imports → `@capi/engine`
- `src/app/api/games/[id]/next-round/route.ts`: engine imports → `@capi/engine`
- `src/components/game/Hand.tsx`: `@/lib/engine/types` → `@capi/engine`
- `src/components/game/Board.tsx`: `./boardLayout` → `@capi/engine`; `@/lib/engine/types` → `@capi/engine`
- `src/components/game/TileDisplay.tsx`: `@/lib/engine/types` → `@capi/engine`
- `src/hooks/useRealtimeGame.ts`: `@/lib/engine/types` → `@capi/engine`

Mechanical find: `grep -rn "@/lib/engine\|./boardLayout\|@/components/game/boardLayout" apps/web/src`. Every hit becomes `@capi/engine`. Use `import type { ... } from "@capi/engine"` where it was a type-only import.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Relocate Next.js app to apps/web; import engine via @capi/engine"
```

### Task A4: Wire the workspace root and verify the gate

**Files:**
- Create: `package.json` (new minimal workspace root)

- [ ] **Step 1: Create the workspace root package.json**

`package.json` at repo root:
```json
{
  "name": "capi-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*", "apps/web"],
  "scripts": {
    "test": "npm test --workspace @capi/engine",
    "test:web": "npm test --workspace @capi/web",
    "dev:web": "npm run dev --workspace @capi/web",
    "build:web": "npm run build --workspace @capi/web"
  }
}
```
(`apps/mobile` is added to `workspaces` in Phase B.)

- [ ] **Step 2: Install the workspace**

```bash
rm -rf node_modules apps/web/node_modules
npm install
```
Expected: completes; `node_modules/@capi/engine` symlink exists (`ls -la node_modules/@capi`).

- [ ] **Step 3: GATE 1 — engine tests pass from the package**

Run: `npm test`
Expected: `Tests 93 passed (93)`.

- [ ] **Step 4: GATE 2 — web builds**

Run: `npm run build:web`
Expected: `✓ Compiled successfully` and the route list printed. No module-resolution errors for `@capi/engine`.

- [ ] **Step 5: GATE 3 — web dev runs and a game works locally**

Start `npm run dev:web`, open http://localhost:3000, create a 1v1 game, confirm the board renders and a tile can be selected. (Manual smoke; backend is the live Supabase via `.env.local`.) Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add npm workspace root; engine tests + web build green from monorepo"
```

- [ ] **Step 7: GATE 4 — production deploy**

Update the Vercel project's **Root Directory** setting to `apps/web` (Vercel dashboard → Project → Settings → Build & Development → Root Directory). Push to main. Confirm the Vercel build succeeds and playcapi.com loads + a game works. **If the deploy fails and cannot be quickly fixed, revert the push and fall back to the "shared engine folder, web at root" layout before proceeding.**

```bash
git push origin main
```

### Task A5: Extract i18n strings into a shared package

**Files:**
- Create: `packages/i18n/package.json`, `packages/i18n/src/strings.ts`
- Modify: `apps/web/src/lib/i18n/context.tsx`, workspace root `package.json`

- [ ] **Step 1: Move the strings table to the package**

```bash
mkdir -p packages/i18n/src
git mv apps/web/src/lib/i18n/strings.ts packages/i18n/src/strings.ts
```

- [ ] **Step 2: Create `packages/i18n/package.json`**

```json
{
  "name": "@capi/i18n",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/strings.ts",
  "types": "./src/strings.ts",
  "exports": { ".": "./src/strings.ts" }
}
```

- [ ] **Step 3: Re-point the web i18n context import**

In `apps/web/src/lib/i18n/context.tsx`: `import { dictionaries, type Lang, type Strings } from "./strings";` → `from "@capi/i18n";`

- [ ] **Step 4: Add `@capi/i18n` to web deps and workspace**

Add `"@capi/i18n": "*"` to `apps/web/package.json` dependencies. (Root `workspaces` already globs `packages/*`.)

- [ ] **Step 5: Reinstall, retest, rebuild**

```bash
npm install
npm test && npm run build:web
```
Expected: 93 tests pass; web builds clean.

- [ ] **Step 6: Commit + push**

```bash
git add -A
git commit -m "Extract i18n strings into @capi/i18n"
git push origin main
```

---

## Phase B — Expo app scaffold

### Task B1: Scaffold the Expo app

**Files:**
- Create: `apps/mobile/` (Expo project)
- Modify: workspace root `package.json` (add `apps/mobile` to workspaces)

- [ ] **Step 1: Create the Expo app (TypeScript, Expo Router tabs template trimmed to blank)**

```bash
cd apps && npx create-expo-app@latest mobile --template blank-typescript && cd ..
```
Expected: `apps/mobile` created with `package.json`, `app.json`, `App.tsx` or `app/` dir.

- [ ] **Step 2: Add mobile to the workspace**

In root `package.json` `workspaces`: `["packages/*", "apps/web", "apps/mobile"]`. Add root scripts:
```json
    "start:mobile": "npm run start --workspace @capi/mobile"
```
Rename the mobile package: in `apps/mobile/package.json` set `"name": "@capi/mobile"`. Add `"@capi/engine": "*"` and `"@capi/i18n": "*"` to its dependencies.

- [ ] **Step 3: Install Expo Router + native deps via expo install (picks compatible versions)**

```bash
cd apps/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-svg @react-native-async-storage/async-storage expo-av expo-haptics
npx expo install @supabase/supabase-js react-native-url-polyfill
cd ../..
npm install
```

- [ ] **Step 4: Configure Expo Router entry**

In `apps/mobile/package.json` set `"main": "expo-router/entry"`. In `apps/mobile/app.json` add under `expo`: `"scheme": "capi"` and `"plugins": ["expo-router"]`. Delete the template `App.tsx` if present. Create `apps/mobile/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Set up NativeWind**

Follow the `expo:expo-tailwind-setup` skill to install and configure NativeWind (it handles `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, and the `nativewind-env.d.ts` types). Configure `content` to include `./app/**/*.{ts,tsx}` and `./components/**/*.{ts,tsx}`. Copy the theme CSS variables (`--accent`, `--board-felt`, etc.) approach as plain JS theme constants in `apps/mobile/theme.ts` (NativeWind variable theming is set up at M2; M1 uses the barbería palette as constants).

- [ ] **Step 6: Configure Metro for the monorepo**

Create/merge `apps/mobile/metro.config.js` so Metro watches the workspace root and resolves the symlinked `@capi/*` packages:
```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
module.exports = config;
```
(If the NativeWind setup already wrapped the config with `withNativeWind`, keep that wrapper and add `watchFolders` + `nodeModulesPaths` to the config object before it is exported.)

- [ ] **Step 7: Boot smoke test**

```bash
cd apps/mobile && npx expo start
```
Open in Expo Go (or `i`/`a` for simulator). Expected: a blank screen renders with no Metro errors resolving `@capi/engine`. Add a temporary `app/index.tsx` that imports and renders `JSON.stringify(createInitialState({mode:"turn_based",theme:"barberia",is2v2:false}).board)` from `@capi/engine` to prove the shared package loads on device. Remove the temp content after confirming. Stop Expo.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Scaffold Expo app (apps/mobile) wired to @capi/engine"
```

---

## Phase C — RN UI vertical slice (1v1, barbería)

Port these web files to RN. Translation rules applied throughout:
- `<div>` → `<View>`; tappable → `<Pressable>`; `<p>/<span>/<h2>` → `<Text>`.
- Keep `className=` (NativeWind). Tailwind classes that have no RN equivalent (e.g. `cursor-pointer`, `select-none`, hover states) are dropped.
- Inline `<svg>` → `react-native-svg` (`Svg`, `Rect`, `Circle`, `Line`, `RadialGradient`, `Stop`, `Defs`, `G`). The pip/gradient logic ports 1:1.
- Absolute positioning uses RN `style={{ position: "absolute", left, top, transform: [{ rotate: \`${deg}deg\` }] }}`.
- `localStorage` → `AsyncStorage` (async).
- The `layoutBoard`, engine, and i18n imports come from `@capi/engine` / `@capi/i18n` — NEVER reimplement the math.

### Task C1: Theme constants + Supabase client + API base

**Files:**
- Create: `apps/mobile/theme.ts`, `apps/mobile/lib/supabase.ts`, `apps/mobile/lib/api.ts`

- [ ] **Step 1: Theme constants (barbería only for M1)**

`apps/mobile/theme.ts`:
```ts
export const THEME = {
  pageBg: "#f5f0e8",
  feltCenter: "#2e8a4e",
  feltMid: "#1a5c2e",
  feltEdge: "#0e3a1a",
  scoreBg: "#2a1210",
  scoreText: "#f5f0e8",
  accent: "#c0392b",
  handBg: "#ebe4d4",
};
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://playcapi.com";
```

- [ ] **Step 2: Supabase client**

`apps/mobile/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});
```
Create `apps/mobile/.env` (gitignored) with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same public values as web `.env.local`), and optionally `EXPO_PUBLIC_API_BASE=http://<your-LAN-ip>:3000` for testing against a local web server, else default prod. Add `apps/mobile/.env` to root `.gitignore`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Mobile: theme constants, supabase client, api base"
```

### Task C2: Port TileDisplay to react-native-svg

**Files:**
- Create: `apps/mobile/components/TileDisplay.tsx`
- Reference: `apps/web/src/components/game/TileDisplay.tsx`

- [ ] **Step 1: Implement the RN tile**

Port the web `TileDisplay` 1:1, replacing the inline `<svg>` pip renderer with `react-native-svg`. The component renders a rounded tile (View with border/bg), a divider line, and two `PipHalf` SVGs. Keep the props (`tile`, `selected`, `small`, `faceDown`, `highlight`, `w`, `h`, `onPress`). Port the `PIP_POSITIONS` map and the radial-gradient drilled-pip exactly (use `<Defs><RadialGradient id=... ><Stop/></RadialGradient></Defs>` and per-instance unique ids via a `useRef` counter, matching the web fix). Tile face/border colors: doubles get the darker face + heavier border, same hex values as web. Selection = amber ring + lift; highlight = emerald ring. Use RN `style` for shadows (`shadowColor/shadowOpacity/shadowRadius/elevation`).

- [ ] **Step 2: Render-smoke**

Temporarily render a row of `<TileDisplay tile={[6,6]} />`, `[3,5]`, `[0,1]` in `app/index.tsx`; confirm pips, divider, double styling, and a face-down back all render on device. Remove temp content.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Mobile: TileDisplay (react-native-svg pips + drilled gradient)"
```

### Task C3: Port the Board (snake layout) to RN

**Files:**
- Create: `apps/mobile/components/Board.tsx`
- Reference: `apps/web/src/components/game/Board.tsx`

- [ ] **Step 1: Implement the RN board**

Port `Board`: a `ScrollView` (both directions; use a horizontal `ScrollView` containing a vertical one, or a single `ScrollView` with `contentContainerStyle` sized to `innerW`×`innerH`). Use the container's measured width (via `onLayout`) as `availW`, call `dimsForWidth(width)` and `layoutBoard(board, width, dims)` from `@capi/engine` — DO NOT reimplement. Render each placement as an absolutely-positioned `<View>` at `{left: p.x + xOffset, top: p.y + yOffset, transform:[{translateX:-half},{translateY:-half},{rotate:\`${p.rot}deg\`}]}` wrapping `<TileDisplay w={dims.TW} h={dims.TH} />`. Port the newest-tile detection (left-end vs right-end index) and the amber last-move ring. Auto-scroll to the newest tile via a `ScrollView` ref + `scrollTo` (only when board grew). Empty-board state shows the "mesa vacía" text.

- [ ] **Step 2: Render-smoke with a fixed board**

Temporarily render `<Board board={[[6,6],[6,3],[3,3],[3,1],[1,5],[5,5],[5,0]]} />` in `app/index.tsx`. Confirm the snake renders, wraps, doubles are crosswise, no overlaps, and it scrolls. Remove temp content.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Mobile: Board snake (reuses @capi/engine layoutBoard)"
```

### Task C4: Port Hand, ScorePanel, CalloutOverlay

**Files:**
- Create: `apps/mobile/components/Hand.tsx`, `apps/mobile/components/ScorePanel.tsx`, `apps/mobile/components/CalloutOverlay.tsx`
- Reference: the same-named web files

- [ ] **Step 1: Hand**

Port `Hand`: horizontal scrollable row of `TileDisplay` (tap = select). When a tile is selected and the board is non-empty, show Left/Right end buttons (disabled per `tileMatchesEnd`). Empty board → tap plays immediately on "left". Draw button when no legal play + boneyard > 0; Pass button when no legal play + boneyard 0. Compute `hasLegalPlay` locally from props exactly as web. Props: `tiles, isMyTurn, boardLeftEnd, boardRightEnd, boneyardCount, onPlay, onPass, onDraw`. Use value-based keys.

- [ ] **Step 2: ScorePanel**

Port `ScorePanel` 1v1 branch only for M1 (the 2v2 branch can be ported now or stubbed; M1 only needs 1v1). Two `PlayerScore`s with avatar initial, name, score, active-turn dot. Include the `ScoreValue` pop-on-change (use RN `Animated` scale, or a simple opacity flash; keep it minimal). Props mirror web.

- [ ] **Step 3: CalloutOverlay + VEINTICINCO banner**

Port `CalloutOverlay` (full-screen modal for domino/capicua/trancao/veinticinco-that-ends-game) using an RN `Modal` or absolute full-screen `View` with the gradient bg, emoji, label, payload points, tap-to-dismiss. Port the mid-round `VeinticincoBanner` (auto-dismissing top banner). Use the same `CALLOUT_CONFIG` labels/emojis.

- [ ] **Step 4: Render-smoke each**

Temporarily mount each with sample props in `app/index.tsx`; confirm visuals. Remove temp content.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Mobile: Hand, ScorePanel, CalloutOverlay components"
```

### Task C5: Port the realtime hook (AsyncStorage + API base + AppState resume)

**Files:**
- Create: `apps/mobile/hooks/useRealtimeGame.ts`
- Reference: `apps/web/src/hooks/useRealtimeGame.ts`

- [ ] **Step 1: Port the hook**

Copy the web hook. Changes only:
- All `fetch("/api/...")` → `fetch(\`${API_BASE}/api/...\`)`.
- Import `supabase` from `../lib/supabase`.
- Session/storage is passed in (the hook already takes `session`); no localStorage here.
- Keep: optimistic play update, in-flight guard, version-keyed callout dismissal, transient errors, 409 handling. These are already hardened — port verbatim.
- Add an `AppState` listener: on `active` (app returns to foreground), call `fetchGame()` so a backgrounded phone re-syncs.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Mobile: useRealtimeGame (API base + AppState resume)"
```

### Task C6: Session storage + i18n context (mobile)

**Files:**
- Create: `apps/mobile/lib/session.ts`, `apps/mobile/lib/i18n.tsx`

- [ ] **Step 1: Session helpers (AsyncStorage)**

`apps/mobile/lib/session.ts`: `getSession(gameId)`, `saveSession(gameId, {playerId, seat})`, `clearSession(gameId)` backed by `AsyncStorage`, key `capi_session_<gameId>`.

- [ ] **Step 2: i18n context**

`apps/mobile/lib/i18n.tsx`: a small React context that holds `lang` (default `"es"`) and exposes `s` from `@capi/i18n` dictionaries — port the web `context.tsx` logic, persisting the choice with AsyncStorage. Wrap the app in `_layout.tsx`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Mobile: AsyncStorage session + i18n context"
```

### Task C7: Create + Join screens

**Files:**
- Create: `apps/mobile/app/index.tsx` (landing: name, color, mode=1v1 fixed for M1, create + join-by-code)
- Reference: `apps/web/src/components/CreateGameForm.tsx`, `JoinGameForm.tsx`

- [ ] **Step 1: Landing screen**

Build `app/index.tsx`: name input, color picker, a "Crear partida" button (POST `${API_BASE}/api/games` with `{nickname, avatarColor, mode:"live", theme:"barberia", is2v2:false, targetScore:100}`), and a "Unirse" path (input 6-char code → GET `${API_BASE}/api/games/by-code/<code>` → navigate). On create success: `saveSession(gameId, {...})` then `router.push(\`/game/${gameId}\`)`. (Mode picker / themes / 200-target are M2 — hardcode 1v1 + barbería + 100 for the slice.)

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Mobile: landing (create + join 1v1)"
```

### Task C8: Game screen (the integration)

**Files:**
- Create: `apps/mobile/app/game/[id].tsx`
- Reference: `apps/web/src/app/game/[id]/page.tsx`

- [ ] **Step 1: Game screen**

Build the route. On mount: read `id` from `useLocalSearchParams`, load session via `getSession(id)`, call `useRealtimeGame(id, session)`. Render states: loading spinner; waiting room (seat slots + "Copiar enlace" via `Clipboard` from `expo-clipboard` + the 6-char `inviteCode` chip); active 1v1 game (ScorePanel top, opponent face-down hand row, `Board`, my `Hand`); round-over overlay (pip breakdown + "Siguiente Ronda" → POST next-round); game-over overlay (winner + "Jugar otra vez" → POST rematch → navigate). Wire `handlePlay/handlePass/handleDraw` → `submitMove`. Play slam haptic (`expo-haptics`) + sound (`expo-av`) on play; callout sound on callout. Use the mid-round VEINTICINCO banner vs full overlay split exactly as web (`isMidRoundCallout = lastCallout === "veinticinco" && phase === "playing"`).

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Mobile: game screen (1v1 end-to-end)"
```

---

## Phase D — Live verification (the M1 exit gate)

### Task D1: Cross-platform 1v1 game, phone vs web

- [ ] **Step 1: Start everything**

Ensure `apps/mobile/.env` points `EXPO_PUBLIC_API_BASE` at production (`https://playcapi.com`) so mobile and web share the live backend. `cd apps/mobile && npx expo start`; open on a device/simulator.

- [ ] **Step 2: Play a full game cross-platform**

On the phone: create a 1v1 game. On a laptop browser at playcapi.com: join via the code/link. Play a complete game to a winner. Verify on the phone:
- Board renders the snake correctly at phone width; no tile overlaps; doubles crosswise.
- Tap-tile → end-choice → play works; pass/draw gating correct.
- Opponent's moves appear via realtime; slam sound/haptic fire.
- Callouts: DOMINÓ / CAPICÚA full overlay; mid-round VEINTICINCO shows as the non-blocking banner and the round continues; score pops.
- Round-over → "Siguiente Ronda" starts the next round with the round winner leading.
- Game-over → "Jugar otra vez" creates a rematch and navigates.
- Backgrounding the app then returning re-syncs the state (AppState resume).

- [ ] **Step 3: Confirm the shared engine is identical**

Run at repo root: `npm test`. Expected: `Tests 93 passed (93)` — the same engine the mobile app just used.

- [ ] **Step 4: Confirm web is unaffected**

playcapi.com still loads and plays (it was verified in Gate 4; re-confirm after all mobile commits since they share the repo). 

- [ ] **Step 5: Final commit / tag M1**

```bash
git add -A
git commit -m "M1 complete: 1v1 mobile vertical slice verified cross-platform" --allow-empty
git push origin main
```

---

## Exit criteria (M1 done)

- A full 1v1 game is playable phone-vs-web with no rule or sync divergence.
- The board snake renders correctly and overlap-free at phone width.
- All 93 engine tests pass from `@capi/engine`; web build + production deploy unaffected.
- Monorepo is in place: `@capi/engine`, `@capi/i18n`, `apps/web`, `apps/mobile`.

Next plans (separate): **M2 parity** (2v2 + themes + chat + sounds + i18n toggle), **M3 store readiness** (EAS, icons/splash, TestFlight/Play internal, Sentry RN), **M4 iMessage** (own design + plan).
