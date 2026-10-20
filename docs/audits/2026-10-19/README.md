# Capi 1.2 ship audit, 2026-10-19

Scope: Capi 1.2.0 before its first TestFlight build (app, iMessage extension,
playcapi.com, server, store text), at HEAD 21bec80. Lanes covered copy and
languages, store submission and old clients, the live web at phone sizes, and
the app at large text sizes. Each finding got an independent check that tried
to refute it. Fixes ran on 2026-10-20 in three lanes, then a second review
(five reviewers, each finding checked by a skeptic) found five more defects,
fixed the same day. Raw evidence stays on the owner's disk in `evidence/`
(not committed: the repo is public).

## Verdict

The code is ready for the first 1.2 build. The release is not ready to submit
until the owner steps below are done. One of them is a blocker for players:
migration 007 is still not run in production (checked 2026-10-20: a select
of players.tile_skin returns HTTP 400). Until it runs, a 1.2 player who owns a
premium tile design gets an error on every create and join.

## Owner steps, in order

The full steps, each with its check, are in docs/submit-1.2-runbook.md.

1. Run supabase/migrations/007_player_tile_skin.sql in the Supabase SQL
   Editor. Then ask Claude to rerun the probe.
2. Accept the Apple Developer Program License Agreement of 2026-10-13 and
   anything pending in App Store Connect > Business.
3. Approve docs/privacy-1.2-draft.md. Claude then puts it on
   playcapi.com/privacy.
4. Run the first 1.2 production build interactively (it adds the Associated
   Domains capability).
5. The TestFlight matrix, the version page, submit with manual release.

## Fixed and verified

Commits 7391d27, f64becb, 61333d9, 56c79a0 (lane fixes), 67e29a3, 1dd6a51,
f6987da (review fixes) and 99381c1 (largest text sizes, gray text). Web checks ran
on the live playcapi.com after the deploy; app checks ran on a Release
simulator build (iPhone SE 3rd generation, 375x667, iOS 26.5).

Website:
- Phone landscape: the table could not be played (0 of 7 hand tiles visible
  at 568x320). A notice "Gira el teléfono para jugar." now covers the table
  on a touch screen held sideways. Live at 568x320: shown, full screen, above
  every overlay. A short desktop window (900x400, mouse) does not show it.
- 2v2 side rails: the tile count boxes sat under the chat and mute buttons
  (overlaps up to 1188 px2). Live: no overlap at 375x548 (5px clear) and
  320x568 (11px clear). With the presence bar 19 to 70px taller (the claim
  button, a notice), the boxes stay 56px above the row bottom, no overlap.
- Problem report dialog ran off the top of a short screen. Live at 900x400:
  the title sits 16px from the top and the dialog scrolls to its bottom edge.
- A finished table had no way home: a "Salir de la mesa" link under the
  rematch button (not inside Messages).
- Copy link and the code chip failed silently when the clipboard refused.
  Live, with the clipboard and share sheet forced to fail: "Copia este
  enlace:" shows the invite link in a field that has the focus and the text
  selected; the code chip shows the code the same way.
- The code chip said "Copiar enlace" but copied the code: it now says
  "Copiar código" (live aria-label "Copiar código FCQJSD").
- Join form: the server error under Join now clears on the next edit (live:
  "Partida no encontrada" cleared after one Backspace). A code for a table
  this browser already sits at opens that table instead of a second join
  (live: redirected to the full test table).
- Quick chat tray: Escape closes it and returns focus to the chat button
  (live).
- Contrast: home tagline and resume label at 6.60:1 (were 4.22); felt labels
  at 4.5:1 or better on every table (patio was 3.17, barberia 4.02, larimar
  3.69); the 2v2 "(frente)" tag and the rail "fichas" line no longer fade
  (were 2.1 to 3.3 and 2.3 to 2.8).
- Share titles: /rules, /privacy and /support had the home page's og:title.
  Live: each page has its own, and no page claims the home URL as og:url.
- The unused domino_slam.mp3 is deleted.

App:
- Large text sizes on the home screen: table names broke mid-word, tile names
  were cut ("Quisqu…"), the top pills overlapped, "Capi" broke as "Cap/i" at
  the largest size, the score cards broke "punt/os", and the resume title was
  cut. Now: 3 tables and 4 tile designs per row at the default size (same as
  1.1), 2 per row from XL, 1 per row from AX2; mode and score cards stack
  from AX4; the pills keep a 1.09x cap and never overlap; the title stops at
  3x; the resume title wraps. Seen in the simulator at Large, XL, XXXL and
  AX5.
- Table felt labels: the opponent line and the boneyard count sat on the
  lightest part of the felt (2.56:1 on the default table). The felt gradient
  now has the web's shape (light pool at 42%, darker top band). Measured from
  simulator pixels on Barbería: 4.86:1 and 4.83:1. The 2v2 rail names and
  "fichas" lines sit on dark chips, 4.97:1 or better on every table (unit
  tests cover each theme).
- Gray text on the home screen, in the waiting room and in the Store moved
  from #9ca3af (about 2.5:1) to 4.5:1 or better.
- The iMessage extension's version now follows app.json on every local
  prebuild (it stayed 1.1.0 before). The Release build shows 1.2.0 for both
  the app and the extension.

Store, build and docs:
- "6-letter code" was false for about 82% of codes (they contain digits). The
  listing now says 6-character, and the runbook pastes the descriptions so
  the fix reaches the store.
- What's New 1.2 in EN and ES, the 1.2 App Review note (3743 of 4000 bytes;
  it says the app opens in Spanish and gives both labels), the submission
  runbook, the privacy draft, and the 1.2 iPhone screenshots at 1206x2622.
- The em-dash check now covers every shipped path, skips audit evidence, and
  fails when a path is missing.
- EAS images pinned to macos-tahoe-26.6-xcode-27.0 ("latest" moved to an
  Xcode 27.1 release candidate).

## Open owner decisions

- The public game GET returns every hand and every player id, and the move
  check trusts the player id. Anyone with a table link could see all hands
  and move for another seat. This predates 1.2. The fix is a private key per
  seat that keeps 1.0 and 1.1 working. In 1.2 or right after?
- Sentry: the web DSN is rejected (403, ProjectId), and the app has no DSN in
  EAS production, so App Group write failures in 1.2 go nowhere.
- The app and the website start in Spanish whatever the device language is.
- Smart App Banner app-argument.
- 320pt-wide devices (iPhone SE 1st generation): at the default text size the
  Spanish pills overlap and "Quisqueya" breaks. Support them or not.
- The iMessage App Store screenshots show the 1.1 create card, without the
  1.2 score and table pickers. Retake or keep.
- Dominican wording for the Spanish share message.

## Known limits

- Android is not measured at large text sizes.
- The EAS build on Xcode 27.0 is new: the local Release build used Xcode 27.1
  RC. The runbook checks the build log.
- docs/tools/build_runbook_page.py is hard-wired to the 1.1 text, so 1.2 has
  no interactive runbook page.
