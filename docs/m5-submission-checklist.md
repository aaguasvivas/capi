# Capi 1.1 submission runbook (iMessage + ads + IAP, one review)

Work top to bottom. Every item is a hard gate for the next. "Me" = Claude in the
repo session; "You" = Adelson in consoles or on phones.

## A. Code gates (Me)

- [ ] `grep -rn "3940256099942544\|PENDING_ADMOB" apps/mobile` returns NOTHING
      (real AdMob ids landed; see D1/D2).
- [ ] All suites green: repo root `npm test` (112), apps/web `npx vitest run`
      (3), apps/mobile `npx vitest run` (7), tsc clean in web and mobile.
- [ ] Build gate passed: prebuild + simulator xcodebuild BUILD SUCCEEDED with
      GADApplicationIdentifier, NSUserTrackingUsageDescription, 50
      SKAdNetworkItems, es.lproj ATT string, and PlugIns/CapiMessages.appex all
      present in the generated output.
- [ ] Simulator pass done (pickers, locked flows, banner placement, skins,
      clasico pixel parity, iMessage regression).
- [x] Web premium themes verified on playcapi.com (2026-08-14: all three render
      live with exact spec colors and watermarks in playing games).

## B. Backend + consoles (You)

- [x] B1. Supabase SQL Editor: run supabase/migrations/002_premium_themes.sql
      (done 2026-08-14, self-test passed; premium creates verified on prod).
- [ ] B2. AdMob: app entry linked to the App Store listing (App settings shows
      "Capi: Dominican Dominoes"). The app-ads.txt warning clears on Google's
      crawl; config is already correct and ads serve meanwhile.
- [ ] B3. Send me the AdMob iOS app id (ca-app-pub-4879291425090726~...) and
      the banner unit id (ca-app-pub-4879291425090726/...).
- [ ] B4. One-time interactive EAS credential run (Apple login) so the
      CapiMessages provisioning profile exists:
      `cd ~/Desktop/personal/capi/apps/mobile && nvm use 20 && npx eas-cli build --platform ios --profile production`
      (answer Yes to the Apple login and profile generation prompts).

## C. Production build (Me, after A + B3 + B4)

- [ ] Swap real AdMob ids into app.json + lib/adUnits.ts, prebuild, sim smoke,
      commit, push.
- [ ] Kick `eas build --platform ios --profile production --non-interactive`
      from apps/mobile (Node 20). Build lands in TestFlight processing.
- [ ] Generate the 8 IAP review screenshots from the store sheet and the
      iMessage screenshots if ASC requires that section.

## D. App Store Connect (You, ~30 minutes total)

- [ ] D1. Create the 8 IAPs per docs/m5-asc-iap-setup.md (if not already done).
- [ ] D2. On the 1.1 version page: attach ALL 8 IAPs in the In-App Purchases
      section, upload my review screenshot on each product.
- [ ] D3. App Privacy: keep the existing Name / Gameplay Content / Customer
      Support entries and ADD: Identifiers > Device ID, used for Advertising,
      Tracking = YES; Usage Data > Product Interaction + Advertising Data;
      Diagnostics > Crash Data + Performance Data (all from the AdMob SDK,
      matching Anota's accepted declarations).
- [ ] D4. Age rating questionnaire: the ads question flips to YES; everything
      else unchanged (Messaging and Chat stays YES).
- [ ] D5. What's New: paste EN and ES from docs/store-listing.md "Version 1.1".
- [ ] D6. App Review notes: paste the updated Guideline 4.2 note from
      docs/store-listing.md (it now discloses the extension, IAPs, and ads).
- [ ] D7. If ASC shows an iMessage screenshot section, upload the ones I
      generate in C.

## E. TestFlight matrix (You + me, two phones)

- [ ] iMessage: create from Messages on phone A, join from phone B's bubble,
      play with live-watch both directions, Open in Capi handoff works.
- [ ] Sandbox purchase of Todo Capi on phone A: banner disappears, all 6
      designs unlock, premium mesa creatable.
- [ ] Phone B: buy one individual design; delete and reinstall the app;
      Restore Purchases brings it back.
- [ ] A web opponent at playcapi.com sees the premium table phone A created.
- [ ] Fichas are local-view: phone A's Kingston tiles do not change what
      phone B or web sees.
- [ ] Fresh install with no purchases: ATT prompt appears exactly once, banner
      shows on home + waiting room, NEVER during play or on the round/game
      overlays.
- [ ] iMessage extension shows no ads anywhere.

## F. Submit (You)

- [ ] Add for Review with the 8 IAPs attached and submit. Review typically
      takes 1 to 3 days. If rejected, paste the message to me and I turn the
      fix around same day.
