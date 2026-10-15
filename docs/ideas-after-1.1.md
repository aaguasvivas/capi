# Ideas and notes after the 1.1 release

Adelson's list from real games with friends after 1.1 went live (2026-10-13). Each item records what the code does today, the options, and the decision. Items are added one at a time.

## Summary (2026-10-15)

| # | Item | Decision | Where it ships |
|---|------|----------|----------------|
| 1 | Other players see your tile backs (option A) | Do it | Server, app, web |
| 2 | Smart App Banner on playcapi.com | Do it | Web only, live after deploy |
| 3 | Full preview before you buy | Do it | App |
| 4 | 100 / 200 points and a table picker in iMessage | Do it | iMessage extension (app build) |
| 5 | Voice notes for trash talk | B (players record), later | App and web |

Items 1, 3, and 4 need a new iOS build and App Review, so they ship together in one release, with the deferred 1.1.1 fixes (`docs/incident-2026-09-30-stalled-turns.md`, `docs/audits/2026-10-05/README.md`). Item 2 is web only and goes live when Vercel deploys.

## 1. Do the paid tile backs ever show?

**Question:** If a player buys Quisqueya fichas, do they see that design on the backs of the tiles across the table? Does anyone else see it?

**What the code does today (checked 2026-10-15):**

- **iOS and Android app:** yes, for the buyer. The chosen design draws the faces of the buyer's own hand, the board, and the backs of the hand across the table (the opponent in 1v1, the partner in 2v2). Code: `apps/mobile/components/TileDisplay.tsx` (the `faceDown` branch) and `TileBack` in `apps/mobile/lib/tileSkins.tsx`.
- **Only the buyer sees it.** The choice is saved on the device only (`@capi/tile_skin` in AsyncStorage). It is not sent to the server. The other players see their own design on the buyer's tiles.
- **2v2:** the left and right opponents show a tile count, not tiles (`SideRail` in `apps/mobile/app/game/[id].tsx`). So in 2v2 the back shows only on the partner's hand.
- **playcapi.com and the iMessage game:** no tile designs at all. The web `TileDisplay` draws the Clásico face and back with fixed colors. The iMessage game runs the web page in a web view, so a buyer who plays through iMessage always sees Clásico.
- **Compare with table designs (mesas):** the mesa is saved on the game (`gameState.theme`), so every player at the table sees it.
- The store text says only "DR flag", "PR flag", "JM flag", so it does not promise that other players see the design.

**Options:**

- **A. Other players see your backs.** Save each player's tile design on their seat when they create or join a game. Draw each hand's backs in its owner's design. The friend across the table sees your Quisqueya backs, which also shows them what they can buy. Work: one new column on `players`, the create and join API routes accept it, both game screens draw backs per seat. The 1.1 app ignores the new field, so older apps keep working.
- **B. Tile designs on the web and in iMessage.** Port the four designs to the web `TileDisplay`. The iMessage extension tells the web page which design the player owns (the extension ships inside the app, so it should be able to read the purchase; confirm before building). Work: larger, mostly the web drawing code and the purchase hand-off.
- **C. Both A and B.**

**Decision (2026-10-15):** do A. B stays open for later.

## 2. Can the web and iMessage versions make money?

**Question:** The app has ads and purchases. Is there more to do on the web and in iMessage?

**iMessage (checked 2026-10-15 against the App Review Guidelines):**

- Ads are not allowed. Guideline 2.5.18 says display ads must stay in the main app binary, not in extensions. Guideline 4.4 says extensions "may not include marketing, advertising, or in-app purchases." The AdMob SDK also does not support Messages extensions (AdMob support reply, 2017).
- Some iMessage games show ads and sell items anyway. That is a review risk, so Capi does not do it.
- Rule for later: the iMessage game is the web page in a web view. If the web site ever shows ads, they must be off in embed mode (`isImessageEmbed` in `apps/web/src/lib/embed.ts`), or the extension breaks 2.5.18.
- Allowed: the extension can show items the player already bought in the app (item 1, option B). The value of iMessage is reach. Every invite bubble shows Capi to a new person.

**Web:**

- **Smart App Banner (recommended, small):** one `<meta name="apple-itunes-app">` tag. Safari on iPhone then shows an "open in the App Store" bar, which moves iPhone players to the app, where ads and purchases earn money. The site has no banner today.
- **AdSense:** Google often rejects sites with little text as "low value content". A game page with no articles fits that pattern. Google's games format (H5 Games Ads) is a closed beta and needs an approved AdSense account first. Pages with real content (rules of Dominican dominoes, strategy, history, in ES and EN) would help approval and search traffic. At today's traffic, web ads would earn very little.
- **Game portals** (sites such as Poki or CrazyGames) host web games and share ad money. They want their own SDK and often exclusive rights. Not a fit for a game played through friend links.
- **Selling items on the web:** allowed by guideline 3.1.3(b) if the same items are also in-app purchases. But Capi has no accounts, so a web purchase cannot follow the player to the phone. This needs accounts plus a payment provider. Not worth it at this scale.

**Decision (2026-10-15):** add the Smart App Banner. Content pages and web ads wait until web traffic grows.

## 3. The store has no real preview of what you buy

**Problem:** A player cannot tap a design in the store to see it. The only view is the small picture in each row, so the buyer guesses from a thumbnail.

**What the code does today (checked 2026-10-15):**

- Each store row (`ProductRow` in `apps/mobile/components/StoreSheet.tsx`) shows a 64 x 44 picture. The "Todo Capi" strip shows the same pictures at 40 x 28. Only the Buy button reacts to a tap.
- The fichas picture shows the faces of two tiles (6-6 and 2-5). **It never shows the back,** which is the flag art and most of the design work.
- The mesa picture shows a small piece of felt with two Clasico tiles.
- On the home screen, a locked design in the picker is dimmed, and a tap opens the store list. That is the same list with the same small pictures.

**Proposal:** a tap on a row (or on a locked card in the home picker) opens a full preview with a Buy button and a Close button. Nothing is bought until the player taps Buy.

- **Fichas preview:** a hand of faces, a row of backs as an opponent sees them, and a short line of tiles on the board, all in the design on sale.
- **Mesa preview:** the felt at full width with the table name and a few tiles, close to the real game screen.
- **Row picture:** change the fichas picture to one face and one back, so the back shows even before the tap.
- Apple has no rule against previews, and the preview code can reuse `SkinScope`, `TileDisplay`, and the game screen's felt.

**Decision (2026-10-15):** build the preview.

## 4. Pick 100 or 200 points when you start an iMessage game

**Question:** iMessage picks 1v1 in a chat with one person and offers 1v1 or 2v2 in a group (both correct). Does it always play to 100 points?

**What the code does today (checked 2026-10-15):** yes, always 100.

- The create card (`CreateCard` in `apps/mobile/targets/messages/CreateJoinViews.swift`) has only the name field and the 1v1 / 2v2 picker.
- `attemptCreate` in `MessagesViewController.swift` calls `CapiAPI.create` without a score, and `CapiAPI.create` defaults to `targetScore: 100`.
- The server already accepts 200, because the app's home screen sends it. So this is a change to the extension only.
- **Same gap for the table:** `CapiAPI.create` also defaults to `theme: "barberia"`, so every iMessage game uses the Barberia table, even for a player who bought a mesa. This connects to item 1, option B.

**Proposal:**

- Add a second segmented picker, "100 / 200", under the 1v1 / 2v2 picker. Show it in every chat, also in a chat with one person. Remember the last choice, as the app's home screen does.
- Pass the choice to `CapiAPI.create`.
- Put the score on the invite bubble (for example "2v2 · 200 pts"), so the people who join know the length before they tap.
- The labels reuse the `score100` and `score200` keys in `packages/i18n`. They go into the Swift mirror `CapiStrings.swift` in the same commit, which `swiftParity.test.ts` checks.
- Check that the card still fits in the compact drawer with two pickers, on the smallest supported iPhone.

**Decision (2026-10-15):** add the 100 / 200 picker, and also a table picker.

**Table picker notes:** the free tables (Barberia, Colmado, Patio) need no purchase check. A bought table needs the extension to know what the player owns. The app and the extension already share an App Group (`group.dev.capi.app`, used by `CapiStore.swift`), so the app can write the owned tables there and the extension reads them. This avoids StoreKit in the extension, which guideline 4.4 does not allow for purchases. The same list can serve item 1, option B (tile designs in iMessage).

## 5. Voice notes for trash talk (feasibility)

**Question:** How hard is it to send short voice notes in a game, in the app, on the web, or in iMessage? A big part of dominoes is the back-and-forth.

**What the game has today:** chat is a fixed set of Dominican phrases and emotes. The server rejects free text (`normalizeChatPayload` in `packages/i18n/src/chat.ts`). This was on purpose (`docs/polish-pass-1.1-2026-09-26.md`, "Free-text chat: recommendation"): content from players brings Apple's guideline 1.2 duties. The store listing, the review notes, and `docs/PLAYBOOK.md` all say "no free-text chat between players".

**iMessage:** not needed. Messages already has voice messages in the same chat, next to the game.

**Options, smallest first:**

- **A. Recorded voice lines.** A set of short clips recorded once by Adelson (or friends), sent like the quick phrases ("¡Capicúa!", "¡Pásala!", "Tú no sabe' jugar"). Nobody records anything during the game, so there is no player content, no microphone permission, and no change to the privacy label or the age rating. It can also be a paid voice pack later. Work: small. The clips ship in the app and on the web, and the chat gets one new message kind. Older apps must ignore it, so it travels under a new broadcast event name.
- **B. Recorded voice notes from players** (hold to talk, up to about 10 seconds). Technically medium:
  - App: microphone permission and recording (`expo-av` is already installed, but the permission text means a new native build).
  - Web: the browser's `MediaRecorder`. Safari and Chrome record different formats, so pick one format that both can play (to confirm).
  - Server: an upload route with size and length limits and a rate limit. Clips go to Supabase Storage and are deleted after the game. A 10-second clip is about 40 to 80 KB.
  - Delivery: a broadcast with the clip id on the game's chat channel, which the other players download and play.
  - **The large part is Apple's guideline 1.2,** because a voice note is content from players. Apple asks for a way to report a clip, a way to block or mute a player, a way to filter objectionable content, and contact details. Capi tables are private and invite-only, which lowers the risk, but review can still ask for these. The privacy label adds Audio Data, the privacy policy changes, the age rating questions change, and the "no free-text chat" claims in the listing and review notes must be rewritten.
  - Size: about one to two weeks, plus a review that may ask questions.
- **C. Live voice chat.** It needs a voice service (for example LiveKit, Agora, or Daily) with a monthly cost, plus everything in B. Not a fit now.

**Recommendation:** A first. It gives the trash talk with almost no review risk. Do B only if players still ask for their own voice after A.

**Decision (2026-10-15):** B, players record their own voice notes. Not now: build it after items 1 to 4 ship. The build must include the guideline 1.2 parts (report, mute or block, filter, contact details) and the privacy, age rating, and listing changes listed above.
