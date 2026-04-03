# Dominican Dominoes MVP — Progress

Track completion of each milestone. Check off when done.

---

- [x] **Milestone 1: Project + Engine Core** — Working reducer with types, validation, scoring, tests. (33/33 tests passing)
- [x] **Milestone 2: Supabase + Turn-based E2E** — Create game, join, play full 1v1 turn-based round via API. Includes boneyard draw mechanic for 1v1.
- [x] **Milestone 3: Live Realtime Layer** — Same game works in Live mode with Supabase Realtime.
- [x] **Milestone 4: Callouts + Polish** — Full-screen skippable callouts, sound toggle, theme selector, plus gameplay/UI polish (see plan.md for full list).
- [x] **Milestone 5: Quick Chat + Emotes** — Buttons and emotes, persisted + Broadcast for live. 6 Dominican phrases + 5 emotes, Supabase Broadcast channel, floating chat bubbles with auto-dismiss, chat receive sound.
- [x] **Milestone 6: 2v2** — Con tu frente, 4 seats, team scoring, TRANCAO/VEINTICINCO for 4 players. Engine already supported 2v2 (TRANCAO@4, VEINTICINCO@3, team pips, draw rejection). Added 21 new 2v2-specific tests (62 total). API: is2v2 toggle in game creation, 4-player join with deterministic seat assignment (n→e→s→w), game starts on 4th join. UI: 2v2 mode toggle in create form, 4-seat waiting room, 4-player layout (partner top, opponents on sides), team ScorePanel with overlapping avatars, team names in round/game overlays.
- [x] **Milestone 7: Rematch + Polish** — Rematch API (POST /api/games/[id]/rematch) + "Play again" button on game over. Pre-allocated snake board layout with auto-scaling. Compact side opponent tile count badges (2v2). Full i18n system: English/Dominican Spanish toggle with 80+ localized strings across all components (landing, forms, game, overlays, chat). Landing page visual polish (gradient bg, cleaner typography). Mobile hardening (overscroll prevention, safe areas, touch selection prevention). All 62 tests pass, zero TS errors.
