# M5: Ads + IAP cosmetics, one combined 1.1 review

Approved direction (2026-08-07): Capi 1.1 ships iMessage (M4, done), AdMob ads, and the
first IAP catalog in a single App Store review. After this milestone the game is
feature-complete for 1.x: the roadmap beyond it is only new cosmetic designs.

## Goals

1. Non-intrusive ads that never touch active gameplay (Anota philosophy).
2. First IAP catalog: Remove Ads, 3 premium tables, 3 premium domino sets, one
   everything bundle. Cheap, impulse-buy pricing.
3. One foolproof App Store submission containing all of it.

## Ads

- Package: `react-native-google-mobile-ads` (same as Anota, pinned to a version
  compatible with Expo SDK 52 / RN 0.76; verify exact version during planning).
- One `ANCHORED_ADAPTIVE_BANNER`, bottom, inside the safe area:
  - Home screen (create/join form): yes.
  - Waiting room: yes.
  - Active play, round-over and game-over overlays: never.
  - iMessage extension and web: never.
- Consent flow ported nearly verbatim from Anota `src/ads/ads.ts`, which encodes
  both of Anota's App Review rejections:
  - Bounded wait for foreground before consent (AppState can sit on "unknown"
    forever on iPad; poll + listener, resolve on active or timeout).
  - UMP `AdsConsent.gatherConsent()` with 15s timeout, then explicit ATT request
    when status is undetermined (UMP alone shows nothing on US devices), then
    `getConsentInfo()` and `mobileAds().initialize()` with timeouts.
  - Explicit "no" stays dark; a broken consent flow fails open to init.
  - `initAds()` idempotent, called only when the user is not ad-free.
- BannerSlot ported from Anota: zero reserved height until an ad loads, height
  reported via onLayout so layout adapts without jumps, retry on load failure
  (max 5 tries, 60s apart, remount by key), permanent null after that. Ads can
  fail forever and the app stays fully usable.
- Dev builds use `TestIds.ADAPTIVE_BANNER`; production unit id is hardcoded.
- app.json plugin config: `iosAppId`, `userTrackingUsageDescription` (Capi copy,
  localized ES via Expo `locales` InfoPlist support), skAdNetworkItems.
- ATT copy says "device", not "phone" (iPad).
- app-ads.txt with pub-4879291425090726 is already live at playcapi.com.
- Waiting on user: AdMob app id (`ca-app-pub-...~...`) and banner unit id.

## IAP

- Library: Anota uses `expo-iap` on SDK 54. Planning step verifies it on SDK 52;
  fallback is `react-native-iap` v12. Non-consumables + Restore Purchases button
  (required by App Review). Entitlements live on the Apple ID; persisted locally
  in AsyncStorage (`@capi/iap_v1`) after purchase/restore. No accounts.
- Catalog (product ids approved by Adelson, durable):

  | Product id             | Name (ES / EN)                          | Price |
  |------------------------|------------------------------------------|-------|
  | `capi.remove_ads`      | Quitar anuncios / Remove Ads             | $1.99 |
  | `capi.mesa.quisqueya`  | Mesa Quisqueya / Quisqueya Table         | $0.99 |
  | `capi.mesa.larimar`    | Mesa Larimar / Larimar Table             | $0.99 |
  | `capi.mesa.noche`      | Mesa Capi Noche / Capi Noche Table       | $0.99 |
  | `capi.fichas.quisqueya`| Fichas Quisqueya / Quisqueya Tiles       | $0.99 |
  | `capi.fichas.borinquen`| Fichas Borinquen / Borinquen Tiles       | $0.99 |
  | `capi.fichas.kingston` | Fichas Kingston / Kingston Tiles         | $0.99 |
  | `capi.todo`            | Todo Capi / All of Capi                  | $4.99 |

- `capi.todo` unlocks everything including Remove Ads (about 40% off the $7.93
  sum). Owning `capi.todo` or `capi.remove_ads` means the ads SDK never
  initializes (Anota adFree pattern).
- Store surface: a sheet reachable from the home screen listing all products
  with owned/price states, Todo Capi highlighted, Restore Purchases, and a
  privacy policy link. Lock badges with prices also appear inline on the mesa
  picker and the new fichas picker; tapping a locked design opens the sheet.
- Catalog is data-driven so future designs are one new product id plus assets.

## Cosmetics

Design principle (Adelson): mesas are quiet, high-contrast backdrops; fichas are
the loud centerpiece. No full-bleed flags on tables.

### Mesas (premium table themes)

Ride the existing per-game theme system (`barberia`/`colmado`/`patio`): the
creator picks, all players see it, theme travels in game state. Three new ids:

- `quisqueya`: deep navy felt (#0f2b56 direction), thin gold piping, faint white
  center emblem (circle + cross at low opacity), tiny red/blue corner accents.
- `larimar`: deep teal felt of the national stone (#17606f direction), soft
  lighter stone glow at center, silvery accents. Calm and elegant.
- `noche`: near-black indigo felt (#131329), indigo neon inner ring (#6366f1),
  small gold CAPI watermark and corner dots. The brand premium table.

Implementation: web gets three `[data-theme="..."]` CSS blocks (all clients must
render them since any opponent may join from web or the iMessage webview);
mobile gets three `ThemePalette` entries plus picker cards. Selection is gated
behind purchase on mobile. The web create form keeps only the three free themes
in 1.1 (web has no purchases). Old 1.0 binaries fall back to Barbería on unknown
theme ids (verified in `getTheme`); web CSS falls back to root defaults.

### Fichas (premium domino sets)

Per-player, local view: your purchased set skins every tile you see (your hand
faces, board faces, opponents' backs), like card backs in poker apps. Each
player sees their own set. Zero engine/server/API changes; the selection is an
AsyncStorage preference on the device. Web and the iMessage webview render the
default set in 1.1.

- `quisqueya`: ivory faces, red pips top half and blue pips bottom half, gold
  spinner/divider; back is the full-bleed DR flag (blue/red quadrants, white
  cross, gold center dot standing in for the shield).
- `borinquen`: white faces, red pips, navy divider; back is navy with a centered
  PR flag patch (three red stripes, two white, equilateral navy triangle
  reaching past the stripes' midpoint, white star at the triangle centroid).
- `kingston`: black faces, gold pips, green divider; back is the full-bleed
  Jamaican flag in reference colors (green #008049 triangles top and bottom,
  black #2b2622 sides, gold #fcb422 saltire corner to corner, band about one
  fifth of tile width).

Flag accuracy is a hard requirement; renders were visually approved against
references on 2026-08-07 (Jamaica corrected once: green top/bottom, never on
the sides).

## Platform architecture summary

- Mobile (native RN): ads, IAP, store sheet, fichas rendering + picker, mesa
  palettes + gated picker.
- Web: three mesa CSS blocks only. No ads, no purchases in 1.1.
- iMessage extension: untouched. Inherits mesa rendering through the game page.
- Engine, server, realtime: untouched.

## Sequencing

1. Implement mobile + web. Web deploys first (additive CSS, safe for 1.0).
2. Verify web themes on playcapi.com, full simulator pass, ship-audit.
3. Production EAS build (extension provisioning profile must exist first; needs
   Adelson's one-time interactive Apple login).
4. Adelson creates the 8 IAPs in ASC from a prepared table (EN/ES names,
   descriptions, price tiers, review screenshots), attaches them to the 1.1
   version, updates App Privacy for ads (Device ID used for tracking and
   third-party advertising, Advertising Data; ATT in place), answers the age
   rating ads question, pastes What's New, adds iMessage screenshots if ASC
   requires them.
5. TestFlight matrix: iMessage two-phone flow, sandbox purchases + restore,
   banner behavior with consent, premium mesa visible cross-platform.
6. Single submission for review.

## Out of scope for 1.1

Web purchases (Stripe), fichas rendering on web or in the extension,
interstitial/rewarded/app-open ads, per-game shared fichas, more designs
(catalog is built to absorb them later).
