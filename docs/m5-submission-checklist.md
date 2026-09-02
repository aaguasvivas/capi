# Capi 1.1 submission runbook (iMessage + ads + IAP, one review)

Work top to bottom. Every item is a hard gate for the next. "Me" = Claude in the
repo session; "You" = Adelson in consoles or on phones.

State on 2026-08-14: build 16 (pre-audit) is in TestFlight; build 17 carries the
deep-audit pass (corrected rules, shared rematch, reconnect, presence, sessionless
join/spectate, deep-link handoff, store honesty, API hardening). Test and submit
build 17, not 16.

## A. Code gates (Me)

- [x] `grep -rn "3940256099942544\|PENDING_ADMOB" apps/mobile` returns NOTHING
      (real AdMob ids landed 2026-08-14).
- [x] All suites green via `npm run verify` (engine 130, web 28, mobile 7, no em
      dashes), tsc clean in web and mobile, `npm run build:web` passes.
- [x] Build gate passed: prebuild + simulator xcodebuild BUILD SUCCEEDED with the
      real GADApplicationIdentifier, ATT strings, 50 SKAdNetworkItems, and
      PlugIns/CapiMessages.appex present.
- [x] Simulator pass done on the audited build: pickers, locked flows, banner on
      home and waiting room only, clasico pixel parity, single-end auto-play,
      end highlights, presence "away" banner, invite code mid-game, leave flow,
      resume cards, sessionless spectator view, seated deep link, store sheet
      with unknown prices, iMessage drawer regression.
- [x] Web premium themes verified on playcapi.com; rematch verified end to end on
      production (shared table, seats preserved, idempotent, theme kept); join
      link states verified live.

## B. Backend + consoles (You)

- [x] B1. Supabase SQL Editor: run supabase/migrations/002_premium_themes.sql.
- [ ] B2. AdMob: app entry linked to the App Store listing (App settings shows
      "Capi: Dominican Dominoes"). The app-ads.txt warning clears on Google's
      crawl; config is verified identical to Anota's and ads serve meanwhile.
- [x] B3. AdMob ids sent and wired (app ~7274134137, banner unit /4870102119).
- [x] B4. One-time interactive EAS credential run done; the CapiMessages
      provisioning profile exists and non-interactive builds work.
- [ ] B5. Anti-cheat, two steps in this exact order:
      1. Vercel > Project > Settings > Environment Variables: add
         SUPABASE_SERVICE_ROLE_KEY (Production, server-only, NOT NEXT_PUBLIC_)
         with the service_role key from Supabase > Project Settings > API, then
         redeploy (Deployments > Redeploy latest). Also add it to
         apps/web/.env.local for local runs. Verify: POST
         https://playcapi.com/api/games with {"nickname":"Probe"} still works.
      2. Only then run supabase/migrations/005_lock_direct_writes.sql in the SQL
         Editor. From that moment the API is the only writer; devtools cannot
         rewrite game state.
- [ ] B6. Any time: run supabase/migrations/004_realtime_publication.sql in the
      SQL Editor (idempotent; records the realtime setup in the schema).

## C. Production build (Me)

- [x] Real AdMob ids swapped in, prebuild, sim smoke, committed, pushed.
- [x] Build 16 kicked, submitted to TestFlight (pre-audit).
- [ ] Build 17 (audit pass) kicked 2026-08-14, then `eas submit --latest`.
- [x] The 8 IAP review screenshots exist in store-assets/iap (one PNG per
      product id). iMessage screenshots on request if ASC shows that section.

## D. App Store Connect (You, ~30 minutes total)

- [ ] D1. Create the 8 IAPs per docs/m5-asc-iap-setup.md (if not already done).
- [ ] D2. On the 1.1 version page: attach ALL 8 IAPs in the In-App Purchases
      section, upload the matching screenshot from store-assets/iap on each.
- [ ] D3. App Privacy: keep the existing Name / Gameplay Content / Customer
      Support entries and ADD: Identifiers > Device ID, used for Advertising,
      Tracking = YES; Usage Data > Product Interaction + Advertising Data;
      Diagnostics > Crash Data + Performance Data (all from the AdMob SDK,
      matching Anota's accepted declarations).
- [ ] D4. Age rating questionnaire: the ads question flips to YES; everything
      else unchanged (Messaging and Chat stays YES).
- [ ] D5. What's New: paste EN and ES from docs/store-listing.md "Version 1.1".
- [ ] D6. App Review notes: paste the updated Guideline 4.2 note from
      docs/store-listing.md (it discloses the extension, IAPs, and ads).
- [ ] D7. If ASC shows an iMessage screenshot section, ask me for the shots.
- [ ] D8. Select build 17 for the 1.1 version (not 16).

## E. TestFlight matrix (You + me, two phones, build 17)

- [ ] iMessage: create from Messages on phone A, join from phone B's bubble,
      play with live-watch both directions, "Open in Capi" seats you in the app
      (the deep link now carries the session), "New game" in the drawer works,
      collapsing the drawer stays collapsed, airplane mode shows the retry view.
- [ ] Rematch: finish a game, tap "Jugar otra vez" on phone A; phone B's button
      turns into "Ir a la revancha" and both land at the same table in the same
      seats.
- [ ] Sandbox purchase of Todo Capi on phone A: banner disappears, all 6
      designs unlock, the bought design is auto-selected.
- [ ] Phone B: buy one individual design; delete and reinstall the app;
      Restore Purchases brings it back; airplane mode restore says "No se pudo
      conectar con la App Store" instead of "nothing to restore".
- [ ] A web opponent at playcapi.com sees the premium table phone A created.
- [ ] Fichas are local-view: phone A's Kingston tiles do not change what
      phone B or web sees.
- [ ] Fresh install with no purchases: ATT prompt appears exactly once, banner
      shows on home + waiting room, NEVER during play or on the round/game
      overlays. Ad-free reinstall: no banner flashes before restore settles.
- [ ] Reconnect: lock phone A mid-game for a minute, unlock: the board catches
      up on its own, and the "Esperando a X, parece que se desconectó" banner
      appears on B while A is away.
- [ ] Tap a tile that fits one end: it plays immediately; a tile that fits both
      ends with different pips shows "Jugar en el N" buttons.
- [ ] Open a full table you are not seated at (any invite link on a third
      device): "Solo mirando" view, no hand, no phantom seat.

## F. Submit (You)

- [ ] Add for Review with the 8 IAPs attached and build 17 selected, then
      submit. Review typically takes 1 to 3 days. If rejected, paste the
      message to me and I turn the fix around same day.
