# Capi - Release Runbook

The app and the listing kit are ready. This is the line-by-line path to submit. Monorepo edition: every command runs from `apps/mobile` with Node 20.

## Status / prerequisites
- Expo: logged in, project linked (@aaguasvivas/capi). Ready.
- Apple Developer Program: ACTIVE (Anota shipped with it). No enrollment wait this time.
- Google Play Console: confirm the account. If it is a new personal account, line up 12+ testers now (see Android); the 14-day closed-test clock only starts once they are in.
- Always run from the mobile workspace with Node 20:
  `cd ~/Desktop/personal/capi/apps/mobile && source ~/.nvm/nvm.sh && nvm use 20`
  Never run expo/eas from the repo root.

## Assets and values (copy from here)
- Privacy policy URL: https://playcapi.com/privacy
- Support URL: https://playcapi.com/support
- Marketing URL: https://playcapi.com
- Listing copy (EN + ES): docs/store-listing.md
- Screenshots (6.7", 1290x2796): OPEN ITEM. Generate from the iOS simulator with staged games (a pretty board mid-round, a capicúa callout, the 2v2 table, the create screen in ES).
- Bundle id / package: dev.capi.app
- Privacy answers: App Store = "Data Not Linked to You" with Name (nickname) + User Content (gameplay, optional bug reports). Play Data Safety = collects App activity + Name, not linked to identity, not shared, not sold. NOT "no data": Capi has a server (see PLAYBOOK.md, Privacy truth).
- Age rating: 4+ / Everyone. Category: Games > Board. Device: iPhone only.
- Encryption: `ITSAppUsesNonExemptEncryption: false` is already in app.json, so no export-compliance questions per build.
- Supabase env values ship via EAS env vars per profile (already pushed; they live in the gitignored apps/mobile/.env locally). `EXPO_PUBLIC_API_BASE` is not needed; the app falls back to https://playcapi.com.

## iOS
```bash
cd ~/Desktop/personal/capi/apps/mobile && source ~/.nvm/nvm.sh && nvm use 20
eas build --platform ios --profile production   # EAS-managed certs for dev.capi.app
eas submit --platform ios                       # uploads to App Store Connect + TestFlight
```
Then in App Store Connect (appstoreconnect.apple.com):
1. Open the app record (eas submit creates it, or create it: name "Capi: Dominican Dominoes", bundle id dev.capi.app).
2. Add `ascAppId` to apps/mobile/eas.json now that the record exists, so future submits are non-interactive:
   ```json
   "submit": { "production": { "ios": { "ascAppId": "<numeric id from the ASC URL>" } } }
   ```
   Commit that change.
3. Paste name, subtitle, keywords, promotional text, and description from docs/store-listing.md. Add the Spanish (es-MX) localization with the ES copy.
4. Upload the 6.7" screenshots.
5. App Privacy: "Data Not Linked to You" with Name (nickname) and User Content (gameplay data, optional bug reports). Paste the privacy URL.
6. Set age rating 4+, category Games > Board, availability iPhone only.
7. In App Review notes, paste the review note from docs/store-listing.md (native multiplayer game, not a wrapper, predefined chat only) and add: reviewers can create a game with any nickname, no account or demo credentials exist. Suggest testing with two devices or one device + a browser at playcapi.com using the invite code.
8. Install the build from TestFlight on a real phone, play a full 1v1 against the browser, then "Add for Review" and Submit. Review is usually 1 to 3 days.

## Android (Google)
Start in parallel: recruit at least 12 testers (friends, family, or a tester-exchange community). New personal accounts must run a closed test with 12+ testers for 14 consecutive days before production access.

When the account is confirmed:
```bash
cd ~/Desktop/personal/capi/apps/mobile && source ~/.nvm/nvm.sh && nvm use 20
eas build --platform android --profile production   # produces an .aab, EAS generates the keystore
```
In Play Console (play.google.com/console):
1. Create the app ("Capi: Dominó Dominicano" for default es, or EN title per default language), package dev.capi.app.
2. On a "Closed testing" track upload the .aab BY HAND the first time (Google requires one manual upload).
3. Add the 12+ testers (email list or a Google Group), publish the closed test, keep it live 14 consecutive days.
4. Fill Data Safety: collects App activity (gameplay) and Name (nickname); not linked to identity; not shared; not sold. Paste the privacy URL. Content rating questionnaire: multiplayer interaction exists but communication is predefined phrases only; no gambling.
5. Add the listing copy (EN + ES from docs/store-listing.md) and screenshots.
6. After 14 days, apply for production access and promote the release.
7. Future updates can use `eas submit --platform android` (after a one-time Google service-account key setup).

## Open items (what remains after these docs)
1. **App Store screenshots** - 6.7 inch, 1290x2796, from the simulator with staged games. Can be produced now.
2. **ascAppId** - add to apps/mobile/eas.json right after the App Store Connect record exists (step 2 above).
3. **TestFlight install pass on a real phone** - only you can do this: install, play a full game vs the browser, check sounds/haptics/safe areas.
4. **Google Play account confirmation** - only you can do this: confirm account standing, and whether the 12-tester/14-day closed test applies.

## After launch (v1.1 ideas, not now)
- Ask-for-review prompt after a couple of finished matches (expo-store-review).
- Sentry on mobile (web already has it) and expo-updates OTA for JS-only fixes.
- Cross-promo with Anota: Capi is the online table, Anota is the scorekeeper for the physical one. A quiet link in each, nothing loud.
- Tasteful monetization per PLAYBOOK.md: cosmetic theme unlock or calm-surface banner, never mid-game. Re-do the privacy labels if ads arrive.
- The most-requested gap will be solo play vs AI; that is a feature decision, not a listing tweak. Copy stays honest until it ships.
