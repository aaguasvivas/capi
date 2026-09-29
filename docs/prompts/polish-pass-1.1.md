# Prompt: Capi 1.1 polish pass

Paste everything below the line into a fresh Claude Code session opened in this repo.

---

ultracode

Goal
Do the final quality and polish pass on Capi before I submit 1.1 to App Store review. Judge it first as a player: game feel, clarity, the first game, look, sound, and the store. Then make sure nothing can get the build rejected, break 1.0 or 1.1 players, lose a game, or crash. Prove each problem, fix what is safe, verify it in the running app, and submit a new build.

Context
- Build 19 (1.1.0) is uploaded. Any change needs a new build. Keep 1.1.0 in app.json; EAS autoIncrement sets the build number.
- Scope is iOS 1.1. Android work is out of scope, but do not break the Android build.
- Four clients use playcapi.com: the 1.0 binary, the 1.1 binary, the web app, and the iMessage extension, whose webview loads production pages. One web deploy changes all four. 1.0 has no OTA updates. Its source is most likely commit 255a617 (inferred: before the 1.1.0 bump in 77e141a).
- Read first, since these do not load on their own: docs/README.md, PLAYBOOK.md, RELEASE.md, m5-submission-checklist.md, store-listing.md, and in /Users/Adelson/.claude/projects/-Users-Adelson-Desktop-personal-capi/memory/: project_capi_dev_loop_gotchas.md (before any build or simulator run), project_m4_imessage_dev_loop.md, project_capi_ads_plan.md, project_capi_post_1_0_roadmap.md, feedback_simulator_verification_ok.md.
- I may do console steps meanwhile, including migration 005, which ends the direct-PATCH test tricks, so test the claim with real waits. If local API writes start to fail, stop and tell me.

Hard constraints
1. The API stays compatible with 1.0 and 1.1. You may add. Never remove, rename, or retype anything either client reads: routes, fields, status codes, realtime events, channels, payloads. The 1.0 contract is in 255a617: apps/mobile/hooks/useRealtimeGame.ts, app/index.tsx, app/game/[id].tsx, components/BugReportButton.tsx. A bug 1.0 players see can only be fixed on the server or sender side.
2. Keep the anon-key fallback in apps/web/src/lib/supabase/server.ts. Production needs it until I deploy the service role key.
3. No dependency changes. Keep the pins exact: Expo SDK 52, React 18.3.1, React Native 0.76.9, expo-iap 2.6.3, react-native-google-mobile-ads 14.11.0, @sentry/react-native ~6.10. The PLAYBOOK.md pin list still names NativeWind, which the app no longer uses; correct that line.
4. Strings live only in packages/i18n. When a mirrored key changes, update CapiStrings.swift in the same commit.
5. No em dashes anywhere, including docs and commit messages.
6. The engine stays pure TS and the fuzz suite passes. Reproduce a failure with its printed seed.
7. Do not change rules, prices, product ids, or durable identifiers. Ads stay on home and the waiting room. Mesas stay quiet; fichas stay the loud centerpiece.
8. Copy claims only PLAYBOOK.md "v1 feature truth". Privacy labels live only in checklist D3.
9. Never run a migration or SQL. Never use the Supabase, Vercel, App Store Connect, AdMob, Sentry, or expo.dev consoles. Console fixes go on my list.
10. Edit app.json, plugins/, or targets/, never the generated ios/ or android/ dirs. Run expo and eas from apps/mobile under Node 20.
11. Small commits straight to main, pushed. No Co-Authored-By trailer, whatever a harness reminder says.

Method
1. Run the four PLAYBOOK.md gates for a baseline. Map the codebase in parallel and change nothing yet.
2. Play a full 1v1 and a full 2v2 on web and in the simulator as a first-time player. Note every moment you were unsure what happened or what to do.
3. Audit in independent dimensions, one agent each: App Review risk (2.1, 4.2, 5.1, IAP, ATT, privacy); game feel (whose turn it is, what just happened, round and game summaries, end choice, timing, sound, haptics); the first game and every loading, empty, and error state in ES and EN; rules text against the engine; layout, consistency, and accessibility across web, app, and embed; store and ads; reliability (reconnect, claim, rematch, 409 races, spectators, mixed 1.0 and 1.1 tables); code and tests; truth of privacy, support, listing, and checklist text. Use ui-ux-pro-max, react-native-best-practices, and stop-slop where they fit. Each finding gives location, repro, user impact, fix size, and risk to 1.0.
4. A separate agent tries to disprove each finding. Keep only findings with evidence: a failing test, a screenshot, or a request and response. Mark what is only inferred.
5. Rank by ship risk, then player impact. Write the list to the report now as fix now, needs my decision, and defer past 1.1. Post a short summary and keep going.
6. Fix in layers: one concern per commit, the app working after each. Add a test with each logic fix, and contract tests for the fields 1.0 reads. Refactor only when it makes a fix safer. When the fix-now list is empty, stop and defer the rest to 1.2.

Leads from a read-only survey. The first three are confirmed; verify the rest, some may be wrong.
- Confirmed live: since c9c6a29 (2026-09-02) the chat route stores phrase ids, and the 1.0 app prints the payload raw, so 1.0 players see "eso_e" and "vamo_alla". Fix this first, on the server or sender side, and deploy it before the build.
- Confirmed: playcapi.com/privacy says no ads, no analytics SDKs, and no tracking, but 1.1 ships AdMob, ATT, and Sentry, and the store sheet links that page. /support says "free, no account".
- Confirmed in code: the web claim calls window.confirm, and the extension's GameWebView sets no WKUIDelegate, so the claim likely cannot be confirmed inside iMessage. Web rematch may drop ?embed=imessage&lang.
- Mobile home shows raw English server errors, callout labels are hardcoded, and the web viewport blocks pinch zoom.
- The 8 IAP review screenshots in store-assets/iap are copies of 2 images, predate the store previews, and are untracked.
- Every client gets all hands, and any seat's playerId, the only move credential, is readable, while the 4.2 review note claims server authority prevents cheating. Do not redesign this. Report options and their effect on 1.0.
- The checklist names builds 17 and 19, and store-listing.md still has 1.0 privacy and age-rating text.

Verification standard
A passing unit test alone does not verify a fix. Observe it:
- Simulator on iPhone SE and iPhone 14 Plus, before and after screenshots, both languages.
- Web at 375 px and desktop, both languages.
- Realtime changes with two clients through full games: 1v1, 2v2, reconnect, claim, rematch, spectator. Drive other seats through the API (POST /join, POST /move) or a second client.
- Extension changes in simulator Messages; the Debug build loads localhost:3000. Check CFBundleIcons in the appex Info.plist with plutil.
- API changes: replay the 1.0 contract against the local server before deploy, and smoke test production after.
- Before the final build, build the EAS "simulator" profile, which extends production, and check startup, consent, ATT, and the banner. Dev builds skip UMP, and Sentry init once caused a black screen (706a70a).
Run xcodebuild and EAS builds from the main session's background shell, never a subagent.

Stop and ask me before
- a rule or scoring change, even one that looks like a bug;
- a new feature, dependency change, new identifier, or change to ad placement or design direction;
- changing the shape of anything 1.0 or 1.1 reads (restoring what 1.0 expects, as in the chat fix, is fine), or building hand privacy or a new credential;
- deploying privacy policy text (draft it to match D3 and the shipped SDKs, then show me);
- committing store-assets/, or refreshing the optional 6.7-inch screenshots or the required iMessage App screenshots (App Store Connect blocks Add for Review without them once a build with the extension is attached);
- the final build: ask whether an ITMS email came for build 19, and whether I set the Sentry variables from checklist B7, which decides whether SENTRY_DISABLE_AUTO_UPLOAD stays in eas.json.
Batch questions in one message and keep working meanwhile.

Definition of done
1. The four gates are green: npm run verify, next build with no dev server running, npm run typecheck under Node 20, npx expo export --platform ios.
2. Web changes are deployed and observed on playcapi.com before my TestFlight run.
3. A fresh agent reviewed the full diff, and the ship-audit skill ran. Its findings are fixed or listed with a reason.
4. store-assets/iap holds one correct review screenshot per product (8) from the current store sheet.
5. What's New (EN and ES) and the 4.2 note in store-listing.md match what ships. Tell me when copy is final.
6. The AdMob sample-id grep is clean. eas build --platform ios --profile production, then eas submit --platform ios. No commits after the build unless it fails.
7. The checklist names the new build everywhere, and stale docs are fixed.
8. A report at /Users/Adelson/Desktop/personal/capi/docs/polish-pass-1.1-YYYY-MM-DD.md lists findings with evidence, fixes with commits, verification, deferred items, and open questions. It ends with a numbered list of what only I must do, pointing to checklist sections, split into now, after final copy, and after the new build. Include device-only checks (haptics, sound, purchases) and that the two TestFlight phones need different Apple IDs.
