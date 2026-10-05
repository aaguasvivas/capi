# Pre-resubmission audit, 2026-10-05

Scope: Capi 1.1.0 build 24 (EAS 92121793, commit f5cadf0) before the owner
resubmits it to App Review, plus the live web and server it depends on (HEAD
2c4a382 at the start). Six lanes ran in parallel, each serious finding got two
independent checks (one tried to refute it, one judged its impact), and a
critic listed what no lane covered. Raw evidence stays on the owner's disk in
`evidence/` (not committed: the repo is public).

## Verdict

No blocker. Build 24 is the right binary, the store answers match it, and the
reviewer path works on the live server.

## What was checked

- Store rules, fetched live from Apple on 2026-10-05: age rating (4+ holds;
  Social Media must stay unchecked), screenshot specs, first-IAP rule, text
  limits, App Privacy definitions, guideline 4.2 and 4.7 for an extension that
  embeds web content.
- Runbook as a state machine: every step's prerequisite and commit action,
  every number recomputed (all paste values within Apple's limits), EN and ES
  parity, every factual claim in the store copy traced to code at HEAD.
- The build 24 binary: Info.plist (export compliance key, AdMob app id,
  SKAdNetwork, tracking prompt in EN and ES), the extension's plist, every
  embedded privacy manifest against the App Privacy answers (exact match), the
  JS bundle (production endpoints, real ad unit ids, no Sentry DSN, the stall
  fix present). No bundled file changed after f5cadf0.
- Live services: playcapi.com pages and API, Supabase REST and realtime, the
  live web bundle matches HEAD, every API change since 1.0 keeps what the 1.0
  app reads, the privacy page names every SDK and processor.
- Production data since the fix: no full table stuck waiting, no status and
  phase mismatch, no finished game below its target, no broken rematch link.
  Stall episodes went from 8 to 0, but after the fix there was almost no chat
  to show the pattern, so that zero is weak evidence.
- Simulator, iPhone 14 Plus, a simulator build of the same code as build 24:
  1. App: a 1v1 game against a bot. The app process was frozen for almost
     four minutes while the bot moved. It showed the right turn 1 second after
     it resumed, and it relayed the state every 10 seconds while the table was
     quiet.
  2. Messages: cold open from the app list, Start a game, Send, tap the
     bubble, waiting room, the browser player joins, Draw (no bubble), play a
     tile (one "Your turn, QA Bot" bubble, drawer gets small), Send, Back to
     the table, the browser player's move shows live.

## Fixed tonight (docs only, no new build needed)

- Review notes, step 6: "On your turn (the browser may go first)". The browser
  player moves first in about half of all games. Notes are 3993 of 4000 bytes.
- Runbook step 6: delete and reinstall first, check the tracking prompt, a
  cancelled purchase, Remove Ads, and the Paid Apps agreement if prices do not
  show.
- Runbook step 7: on your turn, Safari may go first, Draw if no tile fits.
- Runbook step 9: what to do if the version page has no purchase section.
- Runbook step 11: Social Media unchecked, "Not Applicable" on the last
  screen, Brazil shows A12.
- Runbook step 13: new step id (the notes changed), phone in +1 form, the byte
  count is computed from the notes.
- Runbook step 15: what to do if App Store Connect refuses a screenshot for
  its alpha channel. The files have an opaque alpha channel; App Store Connect
  accepted the same format for the 1.0 screenshots.
- Runbook step 17: id carries the build number (an old tick no longer hides
  it), the draft is under App Review > Drafts, and a fallback to attach any
  missing purchase.
- Runbook step 1: send Claude any App Review message still waiting.

## Not tested, and who covers it

- A round that ends on the reviewer's own tile, inside Messages. Covered by
  code reading and unit tests only. A direct database edit to set up that
  position on production was refused by the permission system.
- Purchases, restore, the tracking prompt and the missed-move check on a real
  iPhone: runbook steps 6 and 8 (owner).
- iPad: not run (no disk space for an iPad simulator). 1.0 passed review with
  the same layout code.

## Deferred to 1.1.1

- Web error monitoring is not live: the production Sentry key is rejected.
- Direct database writes with the publishable key stay open until migration
  005 runs (planned after approval).
- The privacy page's retention line and its Sentry wording can be more exact.
- Store copy "gameplay is never linked to your identity" is accurate under
  Apple's labels; a clearer line is an option for the next version.
- Microphone and photo APIs are linked by SDKs without purpose strings; the
  app uses neither. Watch for an ITMS-90683 email (runbook step 2).
- Flatten the screenshot sets to RGB so the files match Apple's written spec.
- Test tables created by agents should all use the "QA " nickname prefix.
