# Capi 1.1 submission runbook (iMessage + ads + IAP, one review)

Work top to bottom. Every item is a hard gate for the next. "Me" = Claude in the
repo session; "You" = Adelson in consoles or on phones.

State on 2026-09-10: builds 16 and 17 were rejected by App Store Connect with
ITMS-90649 (no iMessage app icon in the bundle). Root cause: the config plugin
created a generic app extension, so Xcode never compiled the icon set; the
target is now the `.messages` subtype and the set includes the 29x29 settings
icons. Build 19 carries that fix plus the claim flow (a silent seat can be
claimed after 2 minutes), the how-to-play page, store previews, typed callout
payloads, the "Te toca" quick phrase, the app version in bug reports, and
Sentry wiring (the app stays off until EAS has a DSN).

State on 2026-09-26: the polish pass (docs/polish-pass-1.1-2026-09-26.md)
changes app code and the bundled rules text after build 19. Build 19 is
superseded: cut a new production build once the pass lands. "The polish-pass
build" below means that build; test and submit it, not 19.

State on 2026-09-27: the polish-pass build is build 20 (EAS id 9dc17f6a, commit
c7e8f1b). It also carries the final ship-audit fixes to the iMessage drawer
(it opened blank from the Messages app menu, and its buttons covered the
table's turn line).

Later on 2026-09-27: the rules update (the pase de salida and the tranque tie
to the player who opened the round, docs/research/rules-2026-09/README.md)
changes the bundled rules text in packages/i18n and app code in apps/mobile
(the "¡PASE DE SALIDA!" banner title and the tranque tie line) after build 20.
Build 20 is superseded. Its "How to play" has no pase de salida section, and it
says the next opener after a tranque is the blocker or the player to his right,
which the new engine breaks on a tie. The What's New in docs/store-listing.md
names the pase de salida, so 1.1 cannot ship on build 20 with those notes. Cut
a new production build once the rules update lands and the server runs it.
"The rules-update build" below means that build; test it, select it in App
Store Connect, and submit it, not 16, 17, 19, or 20. It is build 21 (EAS id
b5e46d7f, commit 9d2377b), uploaded to App Store Connect on 2026-09-27.

State on 2026-09-29: the iMessage fix pass changes the extension's Swift
sources (apps/mobile/targets/messages), adds the extension's own privacy
manifest (plugins/withMessagesExtension.js), and adds a line to the app's
table for Messages games (apps/mobile/app/game/[id].tsx) after build 21.
Build 21 is superseded. "The iMessage fix build" below means the next
production build, build 22 (EAS id f259d3ed, commit f0ef651, uploaded to
App Store Connect on 2026-09-29, submission 337e00a5); test it, select it, and
submit it, not 21. Its web half (named turn bubbles, the result bubble from
the player whose move ended the round, the next-round and rematch bubbles, the
drawer's error screen, the hand and round-card fixes for short drawers) is
live on playcapi.com since commit f0ef651. It also carries the capicúa rule
of 2026-09-28: a double on matching ends counts.

## A. Code gates (Me)

- [x] `grep -rn "3940256099942544\|PENDING_ADMOB" apps/mobile` returns NOTHING
      (real AdMob ids landed 2026-08-14).
- [x] All suites green via `npm run verify` (engine 180, web 84, mobile 35, no
      em dashes), `npm run typecheck` clean, `npm run build:web` passes (rules
      update tree, 2026-09-27).
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
         This probe passes with or without the key, so it only shows that the
         redeploy is healthy; step 3 is the real check.
      2. Only then run supabase/migrations/005_lock_direct_writes.sql in the SQL
         Editor. From that moment the API is the only writer; devtools cannot
         rewrite game state.
      3. Right after 005, verify against playcapi.com: create a game in one
         browser, join it from a second browser or phone, and play one move.
         All three must succeed, and the move must stay on the board after a
         reload. If any step fails (or the move snaps back), the API is not
         using the service key: re-create the policies 005 dropped (copy their
         create policy / grant lines from 001_initial.sql, 002_chat_emotes.sql
         and 003_bug_reports.sql) in the SQL Editor, fix the Vercel variable,
         redeploy, and repeat steps 2 and 3.
- [ ] B6. Any time: run supabase/migrations/004_realtime_publication.sql in the
      SQL Editor (idempotent; records the realtime setup in the schema).
- [ ] B7. Error reporting, any time: create a Sentry account with one org and
      two projects (Next.js and React Native). Vercel: NEXT_PUBLIC_SENTRY_DSN,
      SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN, then redeploy.
      EAS (Production): EXPO_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT and
      the secret SENTRY_AUTH_TOKEN; then delete SENTRY_DISABLE_AUTO_UPLOAD from
      eas.json's production profile and tell me, I kick the next build. The
      web half is already live: the production bundle on playcapi.com carries a
      Sentry DSN, so the website and the iMessage game view report errors now
      (confirm the Vercel source-map variables). The app runs with reporting
      off until the EAS half is done; nothing breaks.
- [x] B8. docs/privacy-1.1-draft.md approved 2026-09-26 (commit 727b10c);
      /privacy and /support carry the 1.1 text live (checked 2026-09-29).

## C. Production build (Me)

- [x] Real AdMob ids swapped in, prebuild, sim smoke, committed, pushed.
- [x] Build 16 kicked, submitted to TestFlight (pre-audit).
- [x] Build 17 (audit pass, EAS id 83ce7a17) built and submitted to App Store
      Connect (submission 75c4c902); rejected by ITMS-90649 like build 16.
- [x] Build 19 (icon fix + September features, EAS id b2cfe343): the .ipa's
      extension declares CFBundleIcons, simulator pass done on iPhone SE and
      14 Plus, submitted to App Store Connect (submission 6782fb49). The ITMS
      email must not come back for it; build 18 is a cancelled build.
- [x] The 8 IAP review screenshots exist in store-assets/iap (one PNG per
      product id). The 4 iMessage App screenshots (1284x2778, the 6.5-inch
      slot) exist in apps/mobile/store-assets/screenshots/imessage.
- [x] The polish-pass build, build 20 (EAS id 9dc17f6a): the production-config
      simulator build of the same code passed on the iPhone SE and 14 Plus;
      the extension fix was checked with a Release build of the extension.
      The .ipa's extension declares CFBundleIcons and version 1.1.0 (20).
      Submitted to App Store Connect on 2026-09-27 (submission b562ae8c).
      Confirm no ITMS email comes back for it. Superseded by the rules update.
- [x] The rules-update build, build 21 (EAS id b5e46d7f, commit 9d2377b).
      The production-config simulator build of the same commit (EAS
      c4dd0222) passed on the 14 Plus against playcapi.com: a crafted 2v2
      opening showed "¡PASE DE SALIDA!" +25 for Norte & Sur, a tied tranque
      showed "Empate: gana Norte, que salió", and "Cómo se juega" has the
      Pase de salida section and the new tie lines. The .ipa's extension
      declares CFBundleIcons and version 1.1.0 (21). Submitted to App Store
      Connect on 2026-09-27 (submission 9a48e179). Confirm no ITMS email
      comes back for it. Superseded by build 22.
- [x] The iMessage fix build, build 22 (EAS id f259d3ed, commit f0ef651).
      Checked on the 14 Plus against playcapi.com after the deploy, with a
      Release build of the same extension and the EAS simulator build of the
      same commit (ae0a4c95): the create card in the small drawer, centered
      even when the drawer opens over the Messages keyboard; the name field
      expanding with the keyboard; invite, "Your turn, Luis" with "Ana 45 ·
      Luis 30", live bot moves, "Ana took the round" with "Ana 81 · Luis 30";
      the app's "Esta mesa es de Mensajes" line on a Messages table. The
      .ipa: version 1.1.0 (22) in the app and the extension, CFBundleIcons,
      the extension's PrivacyInfo.xcprivacy, the new capicúa sentences in
      both languages. Submitted to App Store Connect on 2026-09-29
      (submission 337e00a5). Confirm no ITMS email comes back for it.
- [x] The privacy-manifest fix build, build 23 (EAS f0070730, commit 28e40b7). Build 22 shipped the
      extension's manifest as the app's own (both files md5 07916a79), and a
      config-level check had passed for it, so check the built product. On
      the build 23 .ipa from EAS:

      ```
      unzip -p Capi.ipa Payload/Capi.app/PrivacyInfo.xcprivacy | plutil -p -
      unzip -p Capi.ipa Payload/Capi.app/PlugIns/CapiMessages.appex/PrivacyInfo.xcprivacy | plutil -p -
      unzip -p Capi.ipa Payload/Capi.app/PrivacyInfo.xcprivacy | md5
      unzip -p Capi.ipa Payload/Capi.app/PlugIns/CapiMessages.appex/PrivacyInfo.xcprivacy | md5
      md5 apps/mobile/targets/messages/PrivacyInfo.xcprivacy
      ```

      Pass: the two .ipa md5 hashes differ. The app root lists UserDefaults
      CA92.1, FileTimestamp C617.1, DiskSpace E174.1 and SystemBootTime
      35F9.1 (plus any reasons the pods add). The appex lists only
      UserDefaults 1C8F.1, and its md5 equals the one of
      apps/mobile/targets/messages/PrivacyInfo.xcprivacy. Do not select or
      submit build 23 until this check passes. Record the result here.
      Result, 2026-09-29: PASS. App root md5 b1c0dfc8 (tracking false;
      UserDefaults CA92.1; FileTimestamp C617.1, 0A2A.1, 3B52.1; DiskSpace
      E174.1, 85F4.1; SystemBootTime 35F9.1). Appex md5 07916a79, UserDefaults
      1C8F.1 only. Version 1.1.0 (23) in the app and the extension,
      CFBundleIcons present, new ATT text, the double capicúa and Messages
      notice strings in the bundle. The simulator build of the same commit
      (EAS 60075b84) showed the remembered home choices after a cold launch
      and the Colmado turn chip; the extension's Swift is unchanged since
      build 22's verified run (only the plugin guard changed).
      Uploaded to App Store Connect on 2026-09-29 (submission fa0fdf23).
- [x] The frozen-turns fix build, build 24 (EAS 92121793, commit f5cadf0).
      A live 1v1 game stalled four times with each screen showing the other
      player's turn (docs/incident-2026-09-30-stalled-turns.md). Build 24
      carries the app side of the fix: the idle resync and relay, a 15 s move
      timeout, no equal-version overwrite of a move in flight, a refetch on
      every channel join, and the claim version. The extension's Swift and the
      config plugins are unchanged since build 23. Auto-submitted from EAS
      (submission be7242de). Result of the same .ipa privacy check, 2026-09-30:
      PASS. App root md5 b1c0dfc8, identical to build 23 (tracking false;
      UserDefaults CA92.1; FileTimestamp C617.1, 0A2A.1, 3B52.1; DiskSpace
      E174.1, 85F4.1; SystemBootTime 35F9.1). Appex md5 07916a79, equal to
      apps/mobile/targets/messages/PrivacyInfo.xcprivacy, UserDefaults 1C8F.1
      only. Version 1.1.0 (24) in the app and the extension; the binary and
      main.jsbundle were built at 23:41 from f5cadf0.
      Uploaded to App Store Connect on 2026-10-01 at 04:05 UTC (EAS
      submission be7242de, status FINISHED, no error).
      Confirm no ITMS email comes back for it.

## D. App Store Connect (You, ~30 minutes total)

- [ ] D0. Open the app in App Store Connect. If the sidebar under iOS App has
      no 1.1.0 entry, create it: the (+) next to iOS App, version 1.1.0. The
      version must match app.json (1.1.0) or the build will not attach.
- [ ] D1. Create the 8 IAPs per docs/m5-asc-iap-setup.md (if not already done).
- [ ] D2. On the 1.1 version page: attach ALL 8 IAPs in the In-App Purchases
      section, upload the matching screenshot from store-assets/iap on each.
- [ ] D3. App Privacy: keep the existing Name / Gameplay Content / Customer
      Support entries and ADD: Identifiers > Device ID, used for Advertising,
      Tracking = YES; Usage Data > Product Interaction + Advertising Data;
      Location > Coarse Location, purpose Third-Party Advertising (AdMob
      estimates a general location from the IP address); Diagnostics > Crash
      Data + Performance Data + Other Diagnostic Data. Two sources: the AdMob
      SDK (its manifest: Crash Data for Analytics; Performance Data and Other
      Diagnostic Data for Third-Party Advertising, Developer Advertising and
      Analytics), and Sentry error reports from the playcapi.com page that
      the iMessage game view loads (and the app, once EAS has a Sentry DSN).
      So also select App Functionality on Crash Data and Other Diagnostic
      Data, not linked to the user, not used for tracking. Performance Data
      stays AdMob only (Sentry runs with tracing off). Anota's accepted label had no Coarse Location or Other Diagnostic
      Data; the shipped SDK's own privacy manifest (Google Mobile Ads 12.2.0)
      declares both. That manifest marks Device ID, Product Interaction,
      Advertising Data and Coarse Location as linked to the user and the
      diagnostics as not linked; only Device ID is tracking. The linked
      answers are your call.
      App Privacy edits stay a draft until you press Publish at the top of
      the App Privacy page; without it the store keeps the old label.
- [ ] D4. Age rating questionnaire: the ads question flips to YES; everything
      else unchanged (Messaging and Chat stays YES).
- [ ] D5. What's New: paste EN and ES from docs/store-listing.md "Version 1.1".
      Also paste the App Store description in both languages: it now names
      the iMessage extension (guideline 4.4) and drops "nobody can cheat".
- [ ] D6. App Review notes: paste the updated Guideline 4.2 note from
      docs/store-listing.md (it discloses the extension, IAPs, and ads).
- [ ] D7. After the build is attached, the version page shows an "iMessage
      App" media section, and Add for Review is blocked until it has
      screenshots. Upload the 4 PNGs from
      apps/mobile/store-assets/screenshots/imessage (1284x2778, the 6.5-inch
      slot, primary locale): the create card, the invite bubble, the live
      table, and the "Your turn" bubble.
- [ ] D8. Select build 24 for the 1.1 version (23 lacks the frozen-turns fix; 22 lacks the app's own
      privacy manifest; 16 and 17 have no iMessage icon; 19 predates the
      polish pass; 20 predates the rules update; 21 predates the iMessage
      fixes).
- [ ] D9. Version Release: choose "Manually release this version" (you press
      release after approval) or "Automatically release this version" (it
      goes live as soon as review approves it).

## E. TestFlight matrix (You + me, two phones, the iMessage fix build)

Sign the two phones into two different Apple IDs (TestFlight and sandbox).
Messages needs two iMessage accounts to exchange bubbles, and purchases
follow the Apple ID: with one ID, phone B's restore would also return phone
A's Todo Capi and the restore test proves nothing.

- [ ] iMessage: create from Messages on phone A, join from phone B's bubble,
      play with live-watch both directions, "Open in Capi" seats you in the app
      (the deep link now carries the session), "New game" in the drawer works,
      airplane mode shows the retry view. Opening Capi from the Messages app
      menu shows the create card right away (not a blank drawer); the drawer's
      buttons sit above the table, not over the turn line; after a move the
      small drawer shows "Volver a la mesa" and it brings the table back.
- [ ] iMessage bubbles (after the Vercel deploy), every staged bubble sent:
      with no name saved, one tap on the name field in the small drawer
      expands it with the keyboard up; a join that deals the first turn to
      phone A stages "Te toca, <A>" on phone B; the loser's "Siguiente ronda"
      stages "Te toca, <winner>"; a blocker who loses a tranque stages
      "<winner> ganó la ronda"; "Jugar otra vez" stages "¡Revancha! Toca para
      jugar", and phone B's tap on it opens the finished table with "Ir a la
      revancha". A third person (group chat) who taps a full table's bubble
      watches it instead of seeing a join form. In the app, a Messages table
      says to play it in Messages on your turn.
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
- [ ] Claim: on phone B's turn, close the app on B and wait. Phone A shows
      "B lleva 1:00 sin jugar" after a minute and "Reclamar la partida" at
      two; tap it, confirm: A gets "B no volvió a jugar. Ganaste la partida."
      and B, on return, sees "Dejaste de jugar y el otro lado reclamó la
      partida." Leaving the table and coming back within two minutes keeps
      the game.
- [ ] Messages app drawer shows the Capi icon (the ITMS-90649 fix) and the
      1.1 bubbles still render.
- [ ] Store: every row shows its preview (tiles in the skin, felt swatch
      with tiles), the Todo Capi card shows the six-box strip, nothing clips
      at 375 points.
- [ ] Home: "Cómo se juega" opens the rules modal; playcapi.com/rules matches.
- [ ] Polish-pass behaviors: an opponent's pass shows "X pasó" for a moment;
      the player on turn sees "Juega pronto..." after a minute; if the other
      phone taps Siguiente ronda first, your round card stays until you close
      it (and closes by itself when it is your turn); the problem-report form
      opens from the score strip, says it goes to the Capi team, and its Send
      button stays above the keyboard; the quick chat tray shows 10 phrases in
      two columns; the status bar is light on the game screen.
- [ ] iMessage: no stall notice and no claim button in a Messages game; a
      rematch from the drawer stays inside Messages, and the next bubble opens
      the new table.
- [ ] Mixed versions: a phone still on 1.0 (App Store) at the same table as
      the new build shows quick-chat phrases as words, not ids like "eso_e".
- [ ] Rules update, 2v2: when the player after the opener cannot play on the
      first tile and the opener's partner plays, the new build shows
      "¡PASE DE SALIDA!" and a 1.0 phone at the same table shows
      "¡VEINTICINCO!", each +25 for the opener's side. "Cómo se juega" has the
      Pase de salida section.

## F. Submit (You)

- [ ] Add for Review with the 8 IAPs attached and build 24 selected, then
      submit. Review typically takes 1 to 3 days. If
      rejected, paste the message to me and I turn the fix around same day.
