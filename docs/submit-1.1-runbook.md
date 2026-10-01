# Capi 1.1: submit, step by step

Do the steps in order. Each step says where to go, what to enter, and how to
know it worked. The paste values live in docs/store-listing.md and
docs/m5-asc-iap-setup.md; the interactive copy of this list (with copy
buttons) is the "Capi 1.1 Submission" page.

Build to submit: **1.1.0 (24)**, EAS id 92121793, commit f5cadf0. Builds 16
through 23 are superseded. Build 23 does not have the fix for games that
froze with nobody's turn (docs/incident-2026-09-30-stalled-turns.md). Work you
already did in App Store Connect for build 23 (purchases, privacy, text,
screenshots) stays; only the steps that depend on the binary are new.

Have open: App Store Connect, AdMob, your iPhone with TestFlight, a computer
with playcapi.com, and this repo folder in Finder (store-assets/iap and
apps/mobile/store-assets/screenshots/imessage).

## Part 1. Before you submit

0. **If build 23 is already in review, pull it back.** App Store Connect >
   Apps > Capi > App Review > Submissions. Only if 1.1.0 shows Waiting for
   Review or In Review with build 23: open the submission and press Remove
   from Review (some pages call it Cancel Submission). Everything you already
   entered stays. If you never submitted, skip this step.
1. **Build gate.** App Store Connect > Apps > Capi > TestFlight > iOS Builds >
   1.1.0: build 24 shows as processed (not Processing, not Invalid
   Binary). Search your developer email for "ITMS" and "Missing API
   declaration" about build 24. Any hit: stop and send it to Claude.
   Claude checked both privacy manifests in the build 24 .ipa on
   2026-09-30: the app's file lists CA92.1, C617.1, 0A2A.1, 3B52.1, E174.1,
   85F4.1 and 35F9.1 (identical to build 23), and the extension keeps its
   own separate file.
2. **AdMob ad rating.** AdMob > Apps > Capi (iOS) > Blocking controls > ad
   content rating: turn off "Match account-level setting", choose G, Save.
   The app also asks for G in code from build 23 on. While you are in AdMob,
   Privacy & messaging must show a published GDPR message for Capi; without
   it, players in the EU and UK get no ads.
3. **Version record.** App Store Connect > Apps > Capi: the sidebar under iOS
   App lists 1.1.0. If not: (+) next to iOS App, 1.1.0, Create.
4. **Create the 8 purchases.** Monetization > In-App Purchases > (+) >
   Non-Consumable, then Reference Name and Product ID, Create. On each
   product page: Availability > all countries > Save; Price Schedule > Add
   Pricing > USD price > Next > Confirm; App Store Localization > English
   (U.S.) and Spanish (Mexico) with the name and description from
   docs/m5-asc-iap-setup.md > Save; Review Information > Screenshot >
   store-assets/iap/<product id>.png > Save.

   | Product ID | Reference name | USD |
   |---|---|---|
   | capi.remove_ads | Remove Ads | 1.99 |
   | capi.mesa.quisqueya | Mesa Quisqueya | 0.99 |
   | capi.mesa.larimar | Mesa Larimar | 0.99 |
   | capi.mesa.noche | Mesa Capi Noche | 0.99 |
   | capi.fichas.quisqueya | Fichas Quisqueya | 0.99 |
   | capi.fichas.borinquen | Fichas Borinquen | 0.99 |
   | capi.fichas.kingston | Fichas Kingston | 0.99 |
   | capi.todo | Todo Capi | 4.99 |

   Done when all 8 say Ready to Submit and none says Missing Metadata. The
   screenshots are 1284x2778 (padded from the first set, which had a size
   Apple does not accept).
5. **Purchase check on your iPhone** (needs step 4). TestFlight > Capi >
   install 1.1.0 (24). Open the store: all 8 rows show a real
   price, not "Ver precio". Buy Mesa Quisqueya (TestFlight does not charge):
   it unlocks and can be selected. Delete the app, reinstall from TestFlight,
   tap Restore Purchases: Quisqueya comes back. Any failure: stop and send
   Claude a screenshot.
6. **Reviewer path on the same iPhone.** Messages > a conversation with
   yourself > (+) > Capi > tap the name field, type a name, Start a game >
   Send > tap the bubble. In Safari open playcapi.com, tap Unirse, enter the
   code and a name. Back in Messages play a tile: the drawer gets small and
   a "Your turn, <name>" bubble waits to be sent; "Back to the table" brings
   the table back.
6b. **A missed move recovers.** Start a 1v1 game in the app (build 24) and
   join it from playcapi.com on a computer. When it is the computer's turn,
   lock the iPhone, play the move on the computer, wait 20 seconds, unlock:
   the app shows your turn. Then turn off Wi-Fi on the iPhone (no cellular
   data) for 20 seconds while the computer moves, and turn it back on: the
   app shows your turn within about 10 seconds. If a screen still shows the
   wrong turn after 20 seconds, send Claude a screenshot of both screens.
7. **Attach the purchases.** The 1.1.0 version page > In-App Purchases and
   Subscriptions > Select > check all 8 > Done > Save (top right).
8. **App Privacy.** App Privacy > Edit. Keep Name, Gameplay Content and
   Customer Support. Add (ads & analytics = Third-Party Advertising +
   Developer's Advertising or Marketing + Analytics):

   | Data type | Purposes | Linked | Tracking |
   |---|---|---|---|
   | Identifiers > Device ID | Ads & analytics | Yes | Yes |
   | Usage Data > Product Interaction | Ads & analytics, App Functionality | Yes | No |
   | Usage Data > Advertising Data | Ads & analytics | Yes | No |
   | Location > Coarse Location | Ads & analytics, App Functionality | Yes | No |
   | Diagnostics > Crash Data | Analytics, App Functionality | No | No |
   | Diagnostics > Performance Data | Ads & analytics, App Functionality | No | No |
   | Diagnostics > Other Diagnostic Data | Ads & analytics, App Functionality | No | No |

   Save each type, then press **Publish** at the top of the page. Without
   Publish the store keeps the 1.0 label. Privacy Policy URL:
   https://playcapi.com/privacy.
9. **Age rating.** App Information > Age Ratings > Edit: Advertising Yes,
   Messaging and Chat Yes, everything else unchanged > Save. The result must
   stay 4+.
10. **Version text, both localizations** (English (U.S.) and Spanish
    (Mexico), locale menu at the top of the version page). What's New: the
    "Version 1.1" blocks in docs/store-listing.md. Description: the App
    Store description blocks. Promotional Text: the new values in the App
    Store tables (optional; it can change any time without review).
    Keywords, Support URL (https://playcapi.com/support) and Marketing URL
    (https://playcapi.com) stay. Save.
11. **App Review Information.** Sign-in required: off. Contact: your name,
    phone, email. Notes: the whole "Apple Guideline 4.2" note from
    docs/store-listing.md (3969 of 4000 bytes). Save.
12. **Build.** Version page > Build > if build 23 is attached, remove it
    (the minus sign next to it) > (+) > 1.1.0 (24) > Done > Save.
    No export compliance question should appear (the app declares no
    non-exempt encryption).
13. **iMessage App screenshots** (the section appears after step 12; 6.5-inch
    display). Upload from apps/mobile/store-assets/screenshots/imessage, in
    this order: 03-table.png, 04-your-turn-bubble.png, 02-invite-bubble.png,
    01-create-card.png. Save. Screenshots lock when you submit.
14. **Release choice.** Version Release: Manually release this version. Save.
15. **Submit.** Add for Review (top right). Open the draft (App Review >
    Submissions): it lists iOS App 1.1.0 and the 8 in-app purchases. Press
    Submit for Review. Status: Waiting for Review.

## Part 2. While Apple reviews (1 to 3 days)

- Deploy to playcapi.com only changes Claude has checked inside the Messages
  drawer. No API contract changes.
- Do not run migration 005 during review.
- A rejection: paste Apple's message to Claude.

## Part 3. Any time, not a gate

- **Vercel plan.** Hobby is for non-commercial use, and 1.1 has ads and
  purchases: move the capi project to Pro before release. In Supabase, check
  the plan, database size and Realtime usage.
- **Sentry.** Web error reports are rejected today (403, project id). At
  sentry.io check that the org, the Next.js project and its client key are
  active, copy the DSN from Settings > Projects > (project) > Client Keys, set
  NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN in Vercel (Production), redeploy, and
  tell Claude.
- **Migration 004** (idempotent) in the Supabase SQL Editor.

## Part 4. After approval

1. Press Release.
2. AdMob: link the app entry to the App Store listing (App settings).
3. Anti-cheat, in this order: Vercel > Settings > Environment Variables >
   SUPABASE_SERVICE_ROLE_KEY (Production, the secret key sb_secret_ from
   Supabase > Project Settings > API Keys) > Save > Redeploy; then run
   supabase/migrations/005_lock_direct_writes.sql; then create a game in one
   browser, join from another, play a move, reload: the move stays. If a
   step fails, follow checklist B5 step 3.
4. Tell Claude: the next build (1.1.1) takes the roadmap in
   docs/polish-pass-1.1-2026-09-26.md and the deferred list in
   docs/incident-2026-09-30-stalled-turns.md.
