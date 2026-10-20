# Capi 1.2: submit, step by step

Do the steps in order. Each step tells you what to do and how to check it.
Stop at a failed check and send Claude the screen or the output.

The paste values are in docs/store-listing.md: the "Version 1.2" What's New
blocks, the App Review note, and the promotional texts. The 1.1 runbook
(docs/submit-1.1-runbook.md) stays as the record of 1.1.

What 1.2 adds:
- Other players see your premium tile backs.
- The Store shows a full preview before you buy.
- iMessage gets a 100 or 200 points picker and a table picker.
- The waiting room gets Share invite.
- The create and join forms tell you what is missing.
- Invite links open the app (universal links).

The 8 purchases are live since 1.1. 1.2 adds no purchase.

Have open:
- App Store Connect.
- Your iPhone, and a second iPhone with a second Apple ID. Both need
  TestFlight.
- A computer with playcapi.com.
- This repo folder in Finder.

## Part 1. Before the build

1. **Accept the pending Apple agreement.** Apple updated the Developer
   Program License Agreement on 2026-10-13. An acceptance before that date
   does not cover it. Sign in at developer.apple.com/account as the Account
   Holder. Accept every agreement the page shows. Then open App Store Connect
   > Business (Agreements, Tax, and Banking) and accept anything pending.
   - Check: developer.apple.com/account shows no agreement banner.
   - Check: App Store Connect > Business shows Paid Apps as Active.
   - Why first: a pending agreement blocks the certificates, identifiers and
     profiles pages. Step 3 must change the App ID, so the build fails
     without this step.

2. **Run migration 007, then ask Claude to rerun the probe.** Open the
   Supabase SQL Editor for the Capi project. Paste the whole file
   supabase/migrations/007_player_tile_skin.sql and press Run.
   - Check: the last query returns one row: tile_skin, text, YES.
   - Then tell Claude "007 ran". Claude reruns the 2026-10-19 probe on
     playcapi.com: a create and a join with a premium tile design.
   - Check: Claude reports HTTP 200 for both. Before 007 they gave HTTP 500.
   - Why: without the column, a 1.2 player with a premium tile design cannot
     create or join a game. The web is already live and needs no change.

## Part 2. The build

3. **Make the first 1.2 production build in your own terminal.** Run it
   interactively, not from Claude, so EAS can sign in to Apple. EAS then adds
   the Associated Domains capability to the App ID and makes a new
   provisioning profile.

   ```bash
   cd ~/Desktop/personal/capi/apps/mobile && source ~/.nvm/nvm.sh && nvm use 20
   node -v
   grep -rn "3940256099942544\|PENDING_ADMOB" app.json app components lib
   eas build -p ios --profile production
   ```

   When EAS asks to log in to your Apple account, answer yes and sign in.
   - Check: `node -v` prints v20.
   - Check: the grep prints nothing (no sample AdMob id, no unit sentinel).
   - Check: the build output names Associated Domains among the capabilities
     it syncs. If it does not, stop and send Claude the output.
   - Check: the build log lists Xcode 27.0 (27A266a). apps/mobile/eas.json
     pins the image macos-tahoe-26.6-xcode-27.0, because "latest" is now an
     Xcode 27.1 release candidate.
   - Check: the build finishes. Note the build number (1.2.0 (N)) and the EAS
     build id.

   Send Claude the EAS build id. Claude downloads the .ipa and checks it:
   - the app's entitlements list applinks:playcapi.com and
     group.dev.capi.app;
   - the CapiMessages extension keeps group.dev.capi.app;
   - the app and the extension both say version 1.2.0 with the same build
     number (a mismatch is an ITMS-90473 rejection);
   - the app and the extension each carry their own privacy manifest.

   Then upload the build:

   ```bash
   eas submit -p ios --id <EAS build id>
   ```

   - Check: open App Store Connect > Apps > Capi > TestFlight > iOS Builds
     > 1.2.0. The build shows as processed, not Processing or Invalid
     Binary.
   - Check: your developer email has no "ITMS" or "Missing API declaration"
     message about this build.

## Part 3. TestFlight

4. **Test matrix on two iPhones and the web.** Install 1.2.0 (N) from
   TestFlight on both phones. Phone A uses your Apple ID. Phone B uses the
   second Apple ID. TestFlight purchases do not charge.

   | Do this | Check |
   |---|---|
   | Phone A: Tienda (Store) > buy a tile design (for example Fichas Kingston) and a table (for example Mesa Larimar). | Both unlock. The home screen selects the bought design. |
   | Phone A: Tienda > tap each design. | A tile design opens Tus fichas, Lo que ven los demás and En la mesa. A table opens its felt. Nothing is cut at the edges. |
   | Phone A: start a 1v1 game with the Kingston tiles. Phone B joins by code. | Phone B draws phone A's tile backs in Kingston. |
   | Phone A: start another 1v1 game. The computer joins at playcapi.com. | The web page draws phone A's tile backs in Kingston. |
   | Phone A: open Capi once after the purchase. Then Messages > a chat with phone B > (+) > Capi. | The create card's table picker lists Larimar. The score picker offers 100 and 200. |
   | Phone A: start a Messages game at 200 with the Larimar table and send the bubble. Phone B taps it and joins. | The bubble shows the points. Phone B sees the Larimar table and phone A's backs in Kingston. |
   | Phone A: in a waiting room, tap Compartir invitación (Share invite) and send. Tap it again and cancel. | The send delivers one message with the link and the code. The cancel sends nothing and shows no error. |
   | Phone B: in Messages or WhatsApp, tap an invite link from phone A (playcapi.com/?join=...). | Capi opens on that table's join card, with the saved name filled in. |
   | Phone B: in Messages, tap a playcapi.com/game/<id> link (copy it from the Safari address bar at a table). | The link stays in Safari. The app does not open. |
   | Phone B: tap Unirse (Join game) with an empty name. Then type abc-123 in the code field. | The name field shows "Escribe tu nombre para jugar." and gets the cursor. The code field shows ABC123. |
   | Phone B: open playcapi.com in Safari. | The Smart App Banner shows at the top of the page. |

   - Check: every row passes. Any failure: stop and send Claude a screenshot
     of both screens.

## Part 4. The version page

5. **Fill the 1.2.0 version page.** App Store Connect > Apps > Capi. If the
   sidebar under iOS App has no 1.2.0, press (+) next to iOS App, enter
   1.2.0, Create. Do both localizations: English (U.S.) and Spanish (Mexico),
   with the locale menu at the top of the page.
   - **What's New:** the "Version 1.2" blocks in docs/store-listing.md.
   - **Promotional Text:** the values in the App Store tables (161 and 167 of
     170 characters).
   - **Screenshots:** under iPhone, open the Dynamic Island (medium) size and
     upload the 8 files in apps/mobile/store-assets/screenshots/marketing-medium.
     Keep the 1.1 order: 07-hero-en, 06-create-en, 02-jalar-es,
     03-invite-es, 05-chat-es, 08-2v2-colmado-es, 04-create-es,
     01-hero-board-es. Each file is 1206x2622, RGB, with no alpha channel.
   - **Build:** Build > (+) > 1.2.0 (N) > Done.
   - **App Review Information > Notes:** the whole block under "Apple
     Guideline 4.2" in docs/store-listing.md (3640 of 4000 bytes). Sign-in
     required stays off.
   - **App Privacy:** no change. The existing Gameplay Content entry covers
     the stored tile design (players.tile_skin). That entry has covered the
     stored table design (games.theme) since 1.1. Do not add a Purchases
     type.
   - **Age rating:** no change, unless App Store Connect asks a new
     question. Then send Claude the question.
   - **Privacy policy page:** approve docs/privacy-1.2-draft.md before you
     submit. Claude puts it live on playcapi.com/privacy and checks it. The
     Privacy Policy URL stays https://playcapi.com/privacy.
   - Press Save.
   - Check: the page shows no red "required" marks in either localization.
   - Check: playcapi.com/privacy shows the 1.2 text and the new date.

## Part 5. Submit

6. **Submit with manual release.** Version Release: Manually release this
   version. Save. Press Add for Review, then Submit for Review.
   - Check: the version status is Waiting for Review.
   - Check: the submission lists iOS App 1.2.0 and no in-app purchase.

7. **Freeze while Apple reviews (1 to 3 days).**
   - Make no schema change and no API contract change.
   - Never run supabase/rollbacks/007_undo_player_tile_skin.sql. Without the
     column, 1.2 players with a premium tile design cannot create or join.
   - Deploy the web only after Claude checks the change inside the iMessage
     drawer. The 1.1 and 1.2 extensions both load playcapi.com.
   - A rejection: paste Apple's message to Claude.

## After approval

1. Press Release.
2. Tell Claude. Claude checks the live listing (version, What's New,
   screenshots) and an invite link on a phone with the store build.
