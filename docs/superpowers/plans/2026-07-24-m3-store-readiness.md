# M3 — Store Readiness (App Store / Play scaffolding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/mobile` a store-submittable app: `dev.capi.app` identity, EAS build pipeline, branded icon/splash, privacy + support pages on playcapi.com, and the Capi release docs — ending with an EAS iOS build kicked toward TestFlight.

**Architecture:** Instantiate the proven Anota playbook (`/Users/Adelson/Desktop/personal/anota`) for Capi with two deltas: (1) Capi is online multiplayer (Supabase), so the privacy story is "gameplay data, not linked to you" instead of Anota's "collects no data", and Supabase env values ship via EAS env vars (they are kept out of git); (2) Capi is a monorepo — all expo/eas commands run from `apps/mobile` under Node 20.

**Tech Stack:** Expo SDK 52 (pinned; React 18.3.1 — do NOT bump), EAS CLI (logged in as `aaguasvivas`), `rsvg-convert` for code-generated icons, Next.js 14 app router for the web pages.

**Brand tokens (from the shipped web mark — `apps/web/src/app/icon.tsx` + `opengraph-image.tsx`):**
ink `#0a0a0a`, soft ink `#1f1f1f`, cream `#f5f0e8`, tile face `#fafaf7`, gold pip `#c9a961`, gold `#b8860b`, warm glow `rgba(255,200,120,…)`. Anota owns green felt + gold ring — Capi stays ink + cream + gold so the two apps read as siblings, not twins.

---

### Task A: App identity + EAS pipeline (`app.json`, `eas.json`, `eas init`, env vars)

**Files:**
- Modify: `apps/mobile/app.json` (full rewrite below; keep `expo-router` plugin)
- Create: `apps/mobile/eas.json`

- [ ] **Step A1: Rewrite `apps/mobile/app.json`** (projectId gets appended by `eas init` in A3):

```json
{
  "expo": {
    "name": "Capi",
    "slug": "capi",
    "scheme": "capi",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a0a"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "dev.capi.app",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "package": "dev.capi.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "monochromeImage": "./assets/android-icon-monochrome.png",
        "backgroundColor": "#0a0a0a"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": ["expo-router"],
    "owner": "aaguasvivas"
  }
}
```

Notes: display name "Capi" (store listing names are longer, set in ASC/Play, not here). `supportsTablet: false` and `ITSAppUsesNonExemptEncryption: false` per playbook. Dark splash matches the app's dark UI. Do not add `newArchEnabled`, `updates`, or `runtimeVersion` — SDK 52 pinned stack, no expo-updates in v1.

- [ ] **Step A2: Create `apps/mobile/eas.json`:**

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development"
    },
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true,
      "environment": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

Note: `submit.production.ios.ascAppId` is added the first time the App Store Connect record exists (Anota's pattern) — deliberately absent now. `environment` binds each profile to the EAS env vars created in A4.

- [ ] **Step A3: Link the EAS project** (writes `extra.eas.projectId` into app.json):

Run: `cd apps/mobile && source ~/.nvm/nvm.sh && nvm use 20 && eas init --non-interactive`
Expected: creates `@aaguasvivas/capi`, app.json gains `extra.eas.projectId`.

- [ ] **Step A4: Push Supabase public env values to EAS** (values live in the gitignored `apps/mobile/.env`; they stay out of git):

```bash
cd apps/mobile
for ENVN in development preview production; do
  eas env:create --environment $ENVN --name EXPO_PUBLIC_SUPABASE_URL --value "$SUPA_URL" --visibility plaintext --non-interactive
  eas env:create --environment $ENVN --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$SUPA_KEY" --visibility plaintext --non-interactive
done
```

(Read the exact var NAMES from `apps/mobile/.env` / `lib/supabase.ts` first and match them.) `EXPO_PUBLIC_API_BASE` is not needed — `theme.ts` falls back to `https://playcapi.com`.

- [ ] **Step A5: Gate** — `npx tsc --noEmit` and `npx expo export --platform ios` still succeed from `apps/mobile`.

- [ ] **Step A6: Commit** — `git add apps/mobile/app.json apps/mobile/eas.json && git commit -m "Mobile: store identity dev.capi.app + EAS build profiles"`

---

### Task B: Capi app icon + splash (code-generated, brand-matched)

**Files:**
- Create: `apps/mobile/scripts/gen-icons.mjs`
- Replace: `apps/mobile/assets/{icon.png, adaptive-icon.png, splash-icon.png, favicon.png, android-icon-monochrome.png}`
- Delete: `apps/mobile/assets/{android-icon-background.png, android-icon-foreground.png}` (template leftovers, superseded)

- [ ] **Step B1: Write `apps/mobile/scripts/gen-icons.mjs`** — same shape as Anota's (`rsvg-convert`, temp svg, render sizes) but drawing the Capi mark. Two variants behind `CAPI_ICON=letter|tile`:
  - `letter` (default): geometric "C" drawn as a thick round-capped arc in cream on an ink field with a soft warm glow (top-right) and the gold pip floating in the C's opening — the shipped web favicon, grown up.
  - `tile`: a single cream, ink-bordered domino tile (the web OG tile style) rotated −8° showing 5|5 with the top-center pip in gold.
  Outputs: `icon.png` 1024 opaque (`-b #0a0a0a`), `favicon.png` 64, `adaptive-icon.png` 1024 transparent at ~0.55 scale (Android safe zone), `splash-icon.png` 1024 transparent at ~0.62 scale, `android-icon-monochrome.png` 1024 all-white silhouette. Writes `assets/icon.svg` for version control.

- [ ] **Step B2: Render BOTH variants to the scratchpad, view the PNGs, pick the stronger mark** (also check legibility mentally at 60px). Wire the winner as default.

- [ ] **Step B3: Generate into `apps/mobile/assets/`, delete the two superseded template PNGs, update nothing else** (app.json from Task A already points at these filenames).

- [ ] **Step B4: Gate** — `npx expo export --platform ios` succeeds (asset resolution).

- [ ] **Step B5: Commit** — `git add -A apps/mobile/assets apps/mobile/scripts && git commit -m "Mobile: Capi app icon, splash, adaptive assets (generated from SVG)"`

---

### Task C: Privacy + support pages on playcapi.com (subagent-friendly)

**Files:**
- Create: `apps/web/src/app/privacy/page.tsx`
- Create: `apps/web/src/app/support/page.tsx`
- Modify: `apps/web/src/app/page.tsx` (footer links to /privacy and /support)

- [ ] **Step C1: `/privacy`** — static, bilingual on one page (ES first, EN below, mirroring how Anota's privacy.html carries both), styled with the site's existing dark aesthetic (inline styles or globals classes, match `page.tsx` conventions). Content must be truthful for Capi:
  - No accounts, no sign-in. You pick a nickname per game.
  - To run online games, the server stores: nickname, avatar color, game moves/scores, and quick-chat selections (predefined phrases only). Games are identified by random codes; data is not linked to your identity.
  - Optional bug reports include the game state and basic device info (OS, screen size, language) to fix issues.
  - Infrastructure: Supabase (database/realtime) and Vercel (hosting). No ads, no analytics SDKs, no tracking, no selling data.
  - Contact: aaguasvivas907@gmail.com. Effective date 2026-07-24. Covers playcapi.com and the Capi mobile app.
  - Writing style: no em dashes anywhere.
- [ ] **Step C2: `/support`** — short bilingual page: what Capi is, how to report a problem (in-app bug button or email), the contact email, link back to home and /privacy.
- [ ] **Step C3: Footer links** on the landing page (Privacidad / Privacy, Soporte / Support per current language), unobtrusive, phone-size safe.
- [ ] **Step C4: Gate** — `cd apps/web && npx next build` exits 0. Do NOT run while the dev server is running.
- [ ] **Step C5: Leave changes uncommitted; report back** (main session reviews + commits — avoids parallel-agent index lock races).

---

### Task D: Capi release docs (subagent-friendly)

**Files:**
- Create: `docs/PLAYBOOK.md` — Capi-specific: monorepo layout, pinned stack warning (SDK 52/React 18.3.1), Node 20 rule, engine/tests/gates, EAS pipeline, how mobile talks to playcapi.com + Supabase.
- Create: `docs/RELEASE.md` — line-by-line runbook modeled on Anota's `docs/RELEASE.md`: iOS (eas build → eas submit → ASC steps incl. adding `ascAppId` to eas.json once known), Android (closed testing, 12 testers × 14 days for new personal accounts), asset/value crib sheet (bundle `dev.capi.app`, privacy URL `https://playcapi.com/privacy`, support URL `https://playcapi.com/support`), and the App Store privacy nutrition answers for Capi: **Data Not Linked to You — Name (nickname), User Content (game moves, optional bug reports)**; Play Data Safety mirrors that. Screenshots (6.7" 1290×2796) listed as a remaining step.
- Create: `docs/store-listing.md` — modeled on Anota's kit, EN + ES within store limits: App Store name `Capi: Dominican Dominoes` / `Capi: Dominó Dominicano`, subtitle, keyword bags (include capicua/kapicu/parejas/dominicano/online/multiplayer; no words repeated from name), descriptions selling what v1 truly has (real Dominican rules: capicúa, paso, tranque, +25 by passes; 1v1 and 2v2 with invite codes; three table themes; quick chat; ES/EN; play at playcapi.com too; no account), Google Play title/short/full, age rating 4+/Everyone (no gambling; chat is predefined phrases only), and an Apple review note (guideline 4.2/4.8 style) explaining it is a real native multiplayer game.
- [ ] **Step D-gate:** facts must match the app (read `apps/mobile/app/index.tsx`, `packages/i18n`, this plan). No em dashes in any store-facing copy. Leave uncommitted; report back.

---

### Task E: Kick the EAS iOS production build

- [ ] **Step E1:** After A+B are committed: `cd apps/mobile && eas build --platform ios --profile production --non-interactive --no-wait`
  - EAS-managed credentials: if the account's Apple team creds (from Anota) let EAS mint the `dev.capi.app` cert/profile non-interactively, the build queues — poll `eas build:list --limit 1` in the background.
  - If it fails on credentials: capture the exact error and put the one-time interactive command (`eas credentials` or interactive `eas build`) in the final report as a user step. Do not loop retries.
- [ ] **Step E2 (stretch):** `eas build --platform android --profile production --non-interactive --no-wait` — EAS auto-generates the keystore; the .aab waits for the Play account.

---

### Task F: Close-out

- [ ] Root `npm test` (99 tests), `apps/web` `npx next build`, mobile `tsc --noEmit` + `npx expo export --platform ios` — all green.
- [ ] Review + commit C and D changes; push everything to main.
- [ ] Verify live: `https://playcapi.com/privacy` and `/support` return 200 with the new content (poll the Vercel build id change).
- [ ] Report: build status/URL, what only the user can do (Apple interactive step if needed, Google Play account, TestFlight install), screenshots as the named next batch.

**Deliberately deferred:** store screenshots (need staged pretty games + 6.7" simulator), `ascAppId` (after ASC record), expo-updates/OTA, Sentry, ads/IAP (v1.1+ per playbook).

---

## Self-review

- Playbook coverage: bundle IDs ✓ eas.json profiles ✓ icon opaque 1024 ✓ supportsTablet:false ✓ encryption flag ✓ privacy URL ✓ listing kit ✓ TestFlight path ✓ Play 14-day note ✓. Screenshots are explicitly deferred, not forgotten.
- No placeholders except two documented decisions (ascAppId after ASC exists; env var names read from `.env` at execution).
- Type/name consistency: asset filenames in Task B match app.json in Task A; URLs in Task D match Task C routes.
