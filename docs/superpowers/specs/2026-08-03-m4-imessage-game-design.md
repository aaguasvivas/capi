# Capi M4: iMessage Game - Design

**Date:** 2026-08-03
**Status:** Approved pending Adelson's spec review
**Decisions made during brainstorm:** web-powered extension (not native SwiftUI, not bubbles-only); v1 ships both 1v1 and 2v2 group-chat play; extension bundle id `dev.capi.app.messages` and App Group `group.dev.capi.app` (confirmed by Adelson).

## 1. Goal

Capi playable directly inside iMessage, GamePigeon-style: create a table from the Messages app drawer, the invite is a bubble in the conversation, friends tap to sit, and turns update the bubble. The requirement that shapes everything: **live waiting**. A player who stays at the table watches the opponent's tiles land in real time, like 8 Ball Pool, not just asynchronous turn bubbles. This is the differentiator over every other dominoes app; none of them live in the group chat where Dominican games actually get organized.

## 2. What ships

A Messages app extension embedded in the existing Capi iOS app (`dev.capi.app`). No separate store listing: anyone who installs Capi gets Capi in the iMessage app drawer. v1 supports:

- 1v1 from any conversation.
- 2v2 from group chats with 3+ participants, seats filled in tap order.
- Spanish and English, following device locale.
- Full rules parity automatically (same server, same engine, same web client).

## 3. Architecture

Native shell, web heart. The extension is a small Swift `MSMessagesAppViewController` responsible for exactly three jobs: bubbles, identity, and seating. The game itself renders in a `WKWebView` pointed at the shipped playcapi.com game screen in a new embed mode.

```
Messages thread
  └─ bubble (MSMessage, one MSSession per game; payload: gameId, join code, mode)
       └─ tap → extension expands
            ├─ not seated yet → native join card → existing join API (URLSession)
            └─ seated → WKWebView: playcapi.com/game/<id>?embed=imessage#s=<session>
                 ├─ moves, jalar, pase, chat, callouts: the verified web client
                 ├─ live-wait: existing broadcast fast path (inherited, not built)
                 └─ JS bridge → shell refreshes the turn bubble
```

The engine package, server API, database, and realtime layer change **zero**. The extension is a fourth client of the same API the web, iOS app, and Android app already use. The never-reimplement-the-math rule holds: no Swift port of rules or board layout exists in this design.

## 4. Components

**a. MessagesExtension (new, Swift, no React Native inside):**
- Drawer UI (compact style): create card (nickname prefilled from App Group, color, mode picker showing 2v2 only when the thread has 3+ participants, theme) and join card (one-tap confirm).
- API client: `URLSession` calls to the existing create and join endpoints.
- Bubble composer: builds `MSMessage` with `MSMessageTemplateLayout` (brand card image from the classic tile mark, localized caption, score subcaption) on one `MSSession` per game so each update collapses the previous bubble.
- Session store: App Group `UserDefaults`; nickname and color shared with the main app, per-game `{playerId, seat}` keyed by gameId, iMessage participant UUID mapped to session so the same person always reclaims their own seat.
- Game container (expanded style): `WKWebView` plus an "Open in Capi" universal-link handoff button.

**b. Web embed mode (small change, `apps/web`):**
- `?embed=imessage` on the game page: hides footer and language toggle, compact header sized for the extension canvas, blocks external navigation.
- Session bootstrap: reads `#s=<playerId,seat>` fragment on first load, writes it to the client session store, then strips it. Fragments never reach server logs.
- JS bridge: after a confirmed own-move, game over, or round over, posts `{type, captionKey, score}` via `window.webkit.messageHandlers.capi` so the shell can refresh the bubble. No-op outside the webview.

**c. Target tooling (config plugin):**
- The extension target is added at build time by config plugin so the prebuild-free workflow and pinned SDK 52 stack stay untouched. Step one of the plan evaluates `@bacons/apple-targets`; if it cannot express a Messages extension cleanly, we hand-roll the plugin (precedent: `withFmtConstevalFix`). Swift sources live in `apps/mobile/targets/messages/`.

**d. EAS:**
- Extension provisioning via EAS managed credentials (`ios.appExtensions` in app config with the confirmed bundle id). Same build profiles; no new workflow.

## 5. Flows

**Create (group or 1v1 thread):** open drawer → card is prefilled → Create → native POST create (mode, theme, nickname, color) → session saved → invite bubble inserted with code and mode → sender is seated and the webview opens.

**Join:** tap bubble → expanded extension → if a session exists for this gameId, straight into the webview seated; otherwise one-tap join card → native POST join → server assigns the next seat (existing deterministic n→e→s→w logic) → webview seated. Fifth tapper in a 2v2 (or third in a 1v1) gets a native "table is full" card; watching without a seat does not exist in the web client today and is a v2 seed, not a v1 promise.

**Play from iMessage:** all in the webview. On own-move confirmation the JS bridge fires and the shell sends the refreshed turn bubble ("Te toca, Cami" / "Your turn, Leo" plus score).

**Play from web or main app (cross-play):** moves land live for anyone watching in iMessage. Known and accepted v1 limitation: those moves cannot refresh the thread's bubble (only a device in the conversation can send an MSMessage). The bubble self-corrects the next time any iMessage participant plays. Server-pushed bubble refresh needs APNs and is explicitly v2.

**Rematch / next round:** existing web flows inside the webview; the bridge fires on game over so the final bubble shows the result.

## 6. Bubble captions and strings

Captions must exist natively (bubbles render when the webview is closed), so the handful of caption strings (your turn, round won, game won, invite) are duplicated in the extension in both languages, keyed to device locale. Accepted, bounded duplication (under ten strings); `packages/i18n` remains the source of truth for everything rendered in-game, and the duplicated keys are listed in a comment block referencing strings.ts.

## 7. Identifiers (confirmed)

- Extension bundle id: `dev.capi.app.messages`
- App Group: `group.dev.capi.app`

Both are children of the existing app identity per Apple convention. Registered on the existing Apple team through EAS managed credentials.

## 8. Testing

- Engine and web suites stand as is; `npm test` must stay green untouched.
- Xcode Messages test harness (simulator two-sided conversation) drives bubble flows: create, join, seat reclaim, collapse behavior, full-table tap.
- Cross-play matrix gains rows: iMessage vs web, iMessage vs main app, each verified in both directions including live-watch (the two-client rule from CLAUDE.md applies).
- 2v2: four participants across two simulators plus web tabs; seat order, parejas teams, and the fifth-tapper spectator state.
- Memory: expanded webview profiled on a real device against the Messages extension memory ceiling.
- ship-audit before the TestFlight build that carries the extension.

## 9. Exit criteria

A full 1v1 game created in iMessage, played to game over between an iMessage player and a web player, with live watching verified in both directions and the thread's bubble reflecting the latest iMessage-side turn. A 2v2 game seated entirely from a group chat reaching at least one round over with correct teams and scoring. All existing tests green; App Review passes with the extension present.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Apple review of web content inside an extension | Parent app is fully native and approved; drawer and bubbles are native; review note updated to explain the extension is a companion surface of the approved app with identical restricted chat |
| Messages extension memory ceiling kills the webview | Game page is light (no heavy media); profile on device early; "Open in Capi" handoff is the pressure valve |
| `@bacons/apple-targets` cannot express a Messages extension | Hand-rolled config plugin, precedent already in repo (`withFmtConstevalFix`) |
| WKWebView storage isolation breaks sessions | Session source of truth is the App Group store; fragment bootstrap reseeds the webview whenever its localStorage is missing |
| Group-thread identity collisions (shared iPad, device restore) | Participant UUID → session map in the App Group; join API remains the arbiter of seats |
| Pinned SDK 52 constraints | Extension is pure Swift added by config plugin; zero RN or Expo package changes |

## 11. Out of scope (v1)

- APNs-pushed bubble refresh for moves made outside iMessage.
- Board-snapshot images rendered into bubble layouts.
- Matchmaking, accounts, Android analog, iPad.

## 12. v2 seeds

APNs bubble refresh via a small server hook; board-image bubble layouts rendered from the engine's layout data; seatless spectator mode for full tables; iMessage-initiated rematch threading.
