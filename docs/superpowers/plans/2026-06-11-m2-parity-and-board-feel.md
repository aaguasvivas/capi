# Capi M2, Board Feel + Web/Mobile Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the domino chain read like real dominoes on a real table (flush tiles, open-end affordance, landing glow) and bring the mobile app to feature parity with web (language toggle, chat, sounds/mute, create-form options, themes, bug report, 2v2).

**Architecture:** All chain geometry stays in `@capi/engine` (`packages/engine/src/boardLayout.ts`), the 99-test suite incl. the never-overlap property tests is the safety net for every geometry change. Mobile work happens in `apps/mobile` (Expo SDK 52, React 18.3.1, NativeWind 4, do NOT bump these); web in `apps/web`. Mobile is a client of the deployed API; no backend changes.

**Research basis (design brief, 2026-06-11):** benchmarks (Flyclops Block mode, Staple Games, MobilityWare Draw) + real Dominican table photos agree: single-path serpentine (rules-correct for block play, no spinners/branching), doubles crosswise, **tiles flush edge-to-edge (zero gap, our #1 divergence)**, fixed tile size with the canvas absorbing growth, open-end legal-move affordance (glow/ghost) as baseline not polish, placement animation with landing glow doubling as last-move indicator. Do NOT adopt: spinner cross layouts, angled 4-sided tables, tile shrinking with chain growth.

**Verification per task:** engine tasks → `npm test` (99 green, incl. overlap property tests); mobile tasks → `cd apps/mobile && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` then (Node 20) `npx expo export --platform ios --output-dir /tmp/m2-export ; rm -rf /tmp/m2-export`; web tasks → `cd apps/web && npx next build`. Commits directly to main, plain imperative subjects, no trailers, push only when the controller says.

---

## Workstream A, Board feel (engine + both renderers)

### Task A1: Flush tile contact (zero in-row gap)

**Files:**
- Modify: `packages/engine/src/boardLayout.ts`
- Tests: `packages/engine/__tests__/boardLayout.test.ts`, `boardLayout.overlap.test.ts` (must stay green unmodified except dims-constant assertions if any hardcode GAP)

- [ ] **Step 1: Set in-row gap to zero in both dims tiers**

In `packages/engine/src/boardLayout.ts` change `DEFAULT_DIMS` GAP from 6 → 0 and `COMPACT_DIMS` GAP from 5 → 0. Keep `VGAP` (row separation) and `EDGE` unchanged. The corner-reserve math (`GAP + TW`) and cursor advances (`len + GAP`) already read GAP from dims, no other change. Tiles' own borders (2-3px) provide the visual seam between flush tiles, exactly like the benchmarks' shared-edge hairline.

- [ ] **Step 2: Run the engine suite**

Run at repo root: `npm test`
Expected: 99 passed. The overlap property tests treat touching (overlap ≤ 0.01) as legal, flush contact must NOT fail them. If any test hardcodes GAP=6/5 expectations, update that assertion to read from dims instead.

- [ ] **Step 3: Visual sanity on web**

`npm run dev:web`, open a game (create + join via curl per the M1 pattern), play 3-4 tiles: tiles now touch edge-to-edge with their borders forming the seam. Screenshot for the record. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add packages/engine
git commit -m "Engine: flush tile contact, zero in-row gap like a real table"
```

### Task A2: Open-end legal-move affordance (web + mobile)

**Files:**
- Modify: `apps/web/src/components/game/Board.tsx` (accept + render open-end highlight)
- Modify: `apps/mobile/components/Board.tsx` (same)
- Modify: `apps/web/src/app/game/[id]/page.tsx`, `apps/mobile/app/game/[id].tsx` (pass the flag)

- [ ] **Step 1: Add an `endsGlow` prop to both Boards**

Both Board components gain `endsGlow?: boolean`. When true, the FIRST and LAST placements (indices 0 and length-1, the two open ends; a single-tile board is one tile with both ends) get a soft emerald halo, visually distinct from the amber last-move ring: web → `boxShadow: "0 0 0 2px rgba(52,211,153,0.55), 0 0 12px rgba(52,211,153,0.35)"` on the tile wrapper (same pattern as the amber ring at the newest index; if a tile is BOTH newest and an end, amber wins); mobile → wrapper View `borderWidth: 2, borderColor: "#34d399", borderRadius: 8, margin: -2` (same margin trick as the amber ring; amber wins on conflict).

- [ ] **Step 2: Wire it to "my turn"**

Web page: `<Board board={board} endsGlow={isMyTurn} />` (locate the two `<Board board={board} />` call sites, 1v1 and 2v2 branches). Mobile game screen: same with its `isMyTurn`.

- [ ] **Step 3: Verify**

Web: `cd apps/web && npx next build` → compiled. Mobile: tsc + expo export → clean. Live check on web dev server: on your turn both end tiles glow emerald; opponent's turn: no glow.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src apps/mobile
git commit -m "Board: emerald glow on open ends during your turn (web + mobile)"
```

### Task A3: Landing glow animation on placement (mobile)

**Files:**
- Modify: `apps/mobile/components/Board.tsx`

- [ ] **Step 1: Animate the newest tile's arrival**

Web already has `animate-tile-slam`. Mobile: in Board.tsx, wrap the newest tile's inner View in an `Animated.View` that on mount (keyed per play, the `n-${i}-${board.length}` key already remounts it) runs a spring: scale from 1.25 → 1 with `Animated.spring(..., { useNativeDriver: true, friction: 5 })`, plus opacity 0.6 → 1 timing 150ms. Use RN core `Animated` (no reanimated import, it's installed but core Animated is sufficient and lighter here).

- [ ] **Step 2: Verify**

tsc + expo export clean. If a simulator is booted, hot-reload check: play a tile, it lands with the spring + settles; if no simulator, the export gate suffices (visual confirmed at the M2 close-out sim run).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/Board.tsx
git commit -m "Mobile Board: landing spring + fade on the newest tile"
```

---

## Workstream B, Parity quick wins (mobile)

### Task B1: Language toggle + bug report button

**Files:**
- Modify: `apps/mobile/app/index.tsx` (ES/EN toggle)
- Create: `apps/mobile/components/BugReportButton.tsx`
- Modify: `apps/mobile/app/game/[id].tsx` (mount bug report)
- Reference: `apps/web/src/app/page.tsx:10-29` (LangToggle), `apps/web/src/components/game/BugReportButton.tsx`

- [ ] **Step 1: ES/EN toggle on the mobile landing**

Port the web `LangToggle`: two small pills top-right of the landing screen; active pill dark. Uses `useI18n()`'s `lang`/`setLang` (already persisted via AsyncStorage, zero new logic).

- [ ] **Step 2: BugReportButton**

Port the web component to RN: a small 🐞 Pressable (bottom-right cluster of the game screen, next to nothing else for now) opening a Modal with a TextInput and send button that POSTs to `${API_BASE}/api/bug-reports` with the same JSON shape the web sends (read the web component + `apps/web/src/app/api/bug-reports/route.ts` for the exact fields: description, gameId, playerId, gameState snapshot, stateVersion). Toast/inline "sent" state, swallow failures gracefully.

- [ ] **Step 3: Verify + commit**

tsc + expo export clean.
```bash
git add apps/mobile
git commit -m "Mobile: ES/EN toggle + bug report button"
```

### Task B2: Sounds + mute parity (mobile)

**Files:**
- Create: `apps/mobile/lib/sounds.ts`
- Modify: `apps/mobile/app/game/[id].tsx`
- Reference: `apps/web/src/lib/sounds.ts` (API + trigger map), web page.tsx triggers (slam 167/224, draw 177, callout 244, chatReceive 131, mute button 553-559)

- [ ] **Step 1: Port the sounds module to expo-av**

`apps/mobile/lib/sounds.ts` exporting the SAME API as web: `playSlam, playDraw, playCallout, playChatReceive, isMuted, setMuted, loadMuteState, preloadSounds`. Implementation: expo-av `Audio.Sound` instances; `slam.mp3` already in `apps/mobile/assets/`; for draw/callout/chat reuse the web's public sound files, copy from `apps/web/public/sounds/` into `apps/mobile/assets/` (check what exists: at least `slam.mp3`, `domino_slam.mp3`; if draw/callout/chat sounds don't exist as files on web, web synthesizes some via WebAudio, then implement those three as short variations using the slam asset at different rates (`setRateAsync`) or skip the missing ones with a no-op and note it). Mute state in AsyncStorage key `capi_muted`. `playsInSilentModeIOS: true`.

- [ ] **Step 2: Wire triggers + mute button**

Game screen: replace the inline slam logic with the module; add `playDraw` on draw, `playCallout` when `lastCallout` appears, mute 🔊/🔇 button bottom-right next to the bug report button, persisting via the module.

- [ ] **Step 3: Verify + commit**

tsc + expo export (confirm the new assets bundle).
```bash
git add apps/mobile
git commit -m "Mobile: sounds module (expo-av) + mute persistence"
```

### Task B3: Create-form options (theme, mode, target)

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Reference: `apps/web/src/components/CreateGameForm.tsx` (theme cards 173-197, ModeGlyph 24-75, target 236-259)

- [ ] **Step 1: Add the three pickers**

Port to RN: theme cards (three gradient swatch rectangles + labels, solid two-color blend approximations are fine), the 1v1/2v2 mode cards with the ModeGlyph (port the SVG via react-native-svg, table + domino + seat dots, team-shaded for 2v2), target score 100/200 buttons. Wire state into the create POST (`theme`, `is2v2`, `targetScore`, API already accepts them).

- [ ] **Step 2: Verify + commit**

tsc + expo export clean. Creating a 2v2 game navigates to the waiting room (which until Task D1 shows only n/s slots, acceptable interim; note it).
```bash
git add apps/mobile
git commit -m "Mobile: create-form theme/mode/target pickers"
```

### Task B4: Quick chat UI (mobile)

**Files:**
- Create: `apps/mobile/components/QuickChat.tsx`
- Modify: `apps/mobile/app/game/[id].tsx`
- Reference: `apps/web/src/components/game/QuickChat.tsx` (tray, phrases 11-19, emotes 21), page.tsx bubbles 573-595 + ChatBubbleDisplay 947-979 + spawn logic 125-157

- [ ] **Step 1: Port QuickChat tray**

RN Modal-less popover: a 💬 Pressable (bottom-left of the felt) toggling a tray of quick phrases (ES/EN via i18n) + emote row. Tapping sends via the hook's `sendChat` (already ported) and closes.

- [ ] **Step 2: Port chat bubbles**

Game screen: destructure `chatMessages`/`dismissChat` from the hook; port the bubble spawn/fade logic (2.5s visible + fade, keep last 3, `playChatReceive` on opponent messages) and `ChatBubbleDisplay` (mine bottom-left above the tray, opponent's top-left) using RN Animated opacity.

- [ ] **Step 3: Verify + commit**

tsc + expo export.
```bash
git add apps/mobile
git commit -m "Mobile: quick chat tray + bubbles"
```

---

## Workstream C, Themes on mobile

### Task C1: Theme system + felt fidelity

**Files:**
- Modify: `apps/mobile/theme.ts` (three palettes)
- Modify: `apps/mobile/app/game/[id].tsx`, `apps/mobile/components/Board.tsx`, `ScorePanel.tsx`, `Hand.tsx` usage (theme prop/context)
- Reference: `apps/web/src/app/globals.css` palettes (barberia 10-20, colmado 27-36, patio 43-52) + felt layers 95-158, watermark page.tsx 598-604

- [ ] **Step 1: Palette table**

`theme.ts` becomes `THEMES: Record<"barberia"|"colmado"|"patio", ThemePalette>` with the exact hex values from globals.css (pageBg, feltCenter/Mid/Edge, scoreBg, scoreText, accent, handBg + the tile constants shared). Export `getTheme(name)` with barberia fallback. Keep the existing `THEME` export aliased to barberia so untouched call sites keep compiling; migrate call sites task-by-task within this task.

- [ ] **Step 2: Apply per-game theme**

Game screen reads `gameState.theme` → `getTheme(...)` → passes palette down (a tiny React context `ThemeProvider` in `apps/mobile/lib/theme-context.tsx` is acceptable if prop-drilling exceeds 3 levels, implementer's choice, note which). Felt: replace the flat `feltMid` background with `expo-linear-gradient` (install via `npx expo install expo-linear-gradient`), a vertical 3-stop gradient feltCenter→feltMid→feltEdge approximating the web's radial pool (RN has no radial in expo-linear-gradient; the vertical approximation + a slightly darker edge is acceptable M2 fidelity). Add the watermark: absolutely-centered rotated Text ("BARBERÍA DON RAMÓN" / "COLMADO LA ESQUINA" / "EL PATIO DE TÍA" per theme) at ~5% white opacity behind the tiles (pointerEvents none, zIndex 0).

- [ ] **Step 3: Verify + commit**

tsc + expo export (expo-linear-gradient resolves). Create a colmado game via the new picker; confirm palette applies (simulator if booted, else defer visual to close-out).
```bash
git add apps/mobile
git commit -m "Mobile: three table themes with gradient felt + watermark"
```

---

## Workstream D, 2v2 on mobile

### Task D1: Waiting room + relative seats + rails

**Files:**
- Modify: `apps/mobile/app/game/[id].tsx`
- Modify: `apps/mobile/components/ScorePanel.tsx` (finish the TODO 2v2 branch: per-team active dot)
- Reference: web page.tsx, `getRelativeSeats` 44-51, rel wiring 435-447, rails 649-701, partner hand 606-646, waiting room 278-350

- [ ] **Step 1: Waiting room 2v2**

Read `gameSettings.is2v2` (hook already surfaces it): seat order n/e/s/w, 2×2 slot grid, N-S / E-W team labels, "con tu frente" note, port from web.

- [ ] **Step 2: Relative seats + rails in the active game**

Port `getRelativeSeats` (pure function, inline it). For 2v2: partner's face-down hand row at top (with partnerTag), left/right rails as narrow columns (avatar + name + tile-count chip + active-turn ring) flanking the Board, exactly the web structure. 1v1 rendering unchanged. `getTeam(mySeat, is2v2)` replaces the hardcoded `false`; ScorePanel gets `is2v2` and its 2v2 branch gains the active-team green dot (mirroring the 1v1 dot).

- [ ] **Step 3: Verify**

tsc + expo export. Full 2v2 live smoke via the M1 bot pattern: create 2v2 on sim/web, join 3 bots via API (`node capi-bot.mjs` works for any seat), play several moves; confirm rails update, partner row correct, turn ring cycles n→e→s→w. (Controller runs this at close-out with the simulator; implementer gates on tsc+export.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "Mobile: 2v2, waiting room, relative seats, side rails, team score"
```

---

## Close-out (controller)

- [ ] Full gates: `npm test` (99) · web `npx next build` · mobile tsc + expo export.
- [ ] Simulator run: create 2v2 colmado game, 3 bots, play with taps, verify rails/theme/chat/sounds/mute/flush-tiles/end-glow/landing-anim on device; screenshots.
- [ ] Web spot-check on prod after push (flush tiles + end glow on playcapi.com).
- [ ] Push all commits; confirm Vercel deploy healthy.
