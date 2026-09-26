# Capi 1.1 polish pass (2026-09-26)

Status: every "fix now" item below is implemented, reviewed, and green on
all four gates. Web and server changes are deployed and checked on
playcapi.com. App and extension changes are typechecked and unit tested but
not yet seen in the simulator: Xcode 27 needs its license accepted first
(see "What only you can do"). The new build waits for that and for your
answers.

Baseline: all four PLAYBOOK gates green before any change (engine 141, web 28,
mobile 7 tests; typecheck clean; `next build` and `expo export` pass).

Method: eleven independent audit dimensions (App Review risk, game feel, states
and i18n, rules text, web layout on the live site, app layout, store and ads,
realtime reliability, the 1.0 contract, code and tests, iMessage and public
text). Every finding went to a separate skeptic told to refute it. 88 findings
survived (none refuted); many are the same problem seen from two angles. The
raw audit with evidence is summarized below by cluster.

## Fix now (in this pass)

1. **Quick chat shows raw ids to 1.0 players (live since 2026-09-02).** Web and
   1.1 broadcast phrase ids; the 1.0 app prints the payload as is ("eso_e").
   Fix: senders broadcast the phrase text in their language, as 1.0 did; the
   server still stores the id; newer receivers map text back to the id.
2. **Claim is dead inside iMessage, and the 2-minute claim applies to
   turn-by-turn iMessage games.** The web claim used `window.confirm`, which the
   extension's webview never shows. Fix: in-page confirm, a JS dialog delegate
   in the extension, and iMessage games are created as `turn_based`, where the
   engine refuses claims.
3. **Rematch inside iMessage leaves embed mode, and later bubbles link the
   finished game.** Fix: keep the query parameters and tell the extension the
   new game over the bridge.
4. **Players use the bug report form as a chat** (emails "Oye", "Coja"). Fix:
   the form is now "Reportar un problema / Report a problem", says it goes to
   the Capi team and points to the table chat, sends with "Enviar a Capi", and
   the button looks less like the chat button. Quick chat gains three phrases
   that cover what people tried to type: "¿Tú ta' ahí?", "¡Apúrate!",
   "¡Buena mano!".
5. **A paying user who reinstalls sees ads and locked designs** because the
   launch restore returns nothing on a fresh install.
6. **EEA consent can fail open while the user reads the form**, and there is no
   way to change the ad consent later (Google requires an entry point).
7. **Purchase failures and Ask to Buy are silent.**
8. **Status bar text is dark on the dark score bar** in every 1.1 game.
9. **Game feel:** passes are invisible; the app never names whose turn it is;
   the player on turn gets no warning before a claim; one player's Next round
   wipes the others' round summary; after a draw the playable tile can land
   off-screen; the web slam sound doubles on your own plays and is silent for
   the opening tile.
10. **Reliability:** a rematch replays the final callout on every client
    (including 1.0); a newcomer's seat could be handed to an original player at a
    rematch table; concurrent joins get "full" while seats are free; the move
    route hides the resync signal after a round end or claim; any database
    error on GET deletes the player's saved seat; chat taps share the move rate
    budget; a write lockout after migration 005 would look like endless
    conflicts; one failed background fetch replaces the table with a dead end;
    the app can apply a late move response over a newer state; 1.0 players
    always look "disconnected" (1.0 never joins presence).
11. **Web layout and accessibility:** bug form under the chat button; chat tray
    runs off short screens; pinch zoom blocked; Noche uses light grays on its
    dark hand panel; lobby truncates your own name; several tap targets under
    44 px; missing form labels; low-contrast gray text; English-only default
    404 page.
12. **App layout and accessibility:** bug form Send button under the keyboard
    on iPhone SE and 6.1-inch; hand controls ignore the table theme; tap targets
    under 44 pt; missing button roles and swatch labels; raw English server
    errors on the home screen.
13. **Docs and store text:** the store listing still says no ATT, no ads, no
    tracking; the review note claims nobody can cheat, says the 25-point award
    exists in 1v1, and says the only free text is a nickname; What's New
    promises live watching in the drawer; PLAYBOOK pins name NativeWind; the
    checklist names build 17; D3 misses coarse location; the rules page misses
    the claim rule and describes capicúa more broadly than the engine scores it.
14. **Tests:** no tests covered the API routes or the 1.0 wire contract. Route
    tests and a 1.0 contract test are added.
15. **IAP review screenshots:** the 8 files are copies of 2 images from a dev
    build that show the "DEV: grant all" button. Regenerated from a
    production-config build.

## Needs your decision

- **Privacy policy (blocker for submission).** The live page says no ads, no
  analytics, no tracking. The replacement is drafted in
  `docs/privacy-1.1-draft.md`; approve it and it goes live (web only, no build).
- **Free-text chat.** Recommendation: not for 1.1 (see below).
- **Capicúa when both open ends show the same number** (for example ends 4 and 4,
  last tile 4-6). The engine pays no bonus; many tables count it. The rules text
  now describes what the engine does.
- **Both sides reach the target in the same round** (possible after a mid-round
  +25): the engine always gives the game to North/South, even with the lower
  score. Recommendation: the higher score wins; a tie goes to the side that won
  the round.
- **2v2 tranque:** every locked board first pays +25 pase corrido to the side
  that played last (the third pass fires it, the fourth locks the board).
  Recommendation: no pase corrido when the fourth pass locks the board.
- **Theme accent contrast** on Colmado, Quisqueya, Larimar and Patio ("¡Tu
  turno!" text and button fills fail WCAG contrast). A design call.
- **First launch language** is Spanish even on English devices, while the
  iMessage extension follows the device language.
- **Hand privacy:** every client receives every hand and every seat's player
  id. A 1.2 design that needs the service key and a transport change.
- **iMessage claims:** now off. A long window (for example 24 hours) is an
  option later.

## Deferred past 1.1

- Web in phone landscape shrinks the board to a strip.
- Callout and chat sounds reuse the tile sound, pitch-shifted.
- In 2v2, every chat bubble appears in the same corner.
- Android: no AdMob Android app id, iOS banner unit, pending purchases
  granted. Out of scope for this iOS submission.
- Premium tables render as Barbería on 1.0 (cannot change the 1.0 binary).

## Free-text chat: recommendation

Do not add it for 1.1. Apple's guideline 1.2 then requires a filter for
objectionable text, a way to report messages, a way to block users, and
timely responses to reports; the age rating and the review note change; and
the 1.0 app would print any text it receives with no filter. The reports show
what players want: to nudge ("Oye", "¿estás ahí?") and to react. The three new
phrases, the claim flow, and the clearer problem form cover that. If players
still ask after 1.1, build chat in 1.2 with a filter, report and block.

## After the fixes: fresh review

Three fresh reviewers read the whole diff; a skeptic checked each finding.
Six were real and are fixed:

- iOS zoomed into small text fields on focus once pinch zoom was allowed, and
  stayed zoomed. Small fields are now 16px on phones.
- The held round card could cover a player's own opening turn while the claim
  clock ran. It now closes for good when the new round reaches that seat (web
  and app).
- The app still showed the away pill in iMessage games; it no longer does.
- A 2v2 rematch refused an original player whose seat a newcomer took, even
  with seats free. It now seats them at the next free seat and stays
  idempotent.
- Create now keeps the column default (turn_based) for clients that send no
  mode, and every current client sends its mode ("live" for the apps and the
  web form, "turn_based" for the extension). Web tables made before this pass
  are turn_based and lose the claim until migration 006 runs (optional).

## Verification

- Gates: `npm run verify` (engine 142, web 75, mobile 26 tests, no em dashes),
  `npm run typecheck`, `next build` (dev server stopped), `expo export`.
- Browser at 375x667 against a local server on the production database:
  quick chat tray (2 columns, fits), the chat broadcast as a 1.0 listener
  sees it ("¿Tú ta' ahí?", stored as ta_ahi), "BotS pasó" notice in a 2v2 with
  bot seats, stall notice, claim with the in-page confirm and cancel, the
  forfeit card, rematch in embed mode keeping ?embed=imessage&lang=es and
  posting the bridge event, no claim UI on a turn-based table (the API answers
  409), the held round card staying readable and closing without a second
  next-round request, the problem-report form, the 404 page, the home page.
- Not verified yet: every app and extension change in the simulator, the
  store sheet with the ad privacy link, the IAP review screenshots, and the
  EAS production-config build. All wait for the Xcode license.
