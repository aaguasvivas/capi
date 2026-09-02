# Dominican Dominoes MVP: Complete Plan

> Historical: the original web-only MVP plan, written before the monorepo, the mobile app, and the milestone specs in docs/superpowers/. Kept for context, not maintained.

---

## 1. MVP SPEC

### 1.1 Rules & Mechanics

- **Set**: Double-six only (28 tiles)
- **Players**: 1v1 first; 2v2 (con tu frente) after 1v1 stable
- **Win**: First to 100 points
- **Start**: Highest double starts; if no doubles, highest tile starts (first player draws 7, second draws 7; remainder stays in boneyard)
- **Turn order**: Clockwise. Must play if possible; else PASS
- **Round end**: (a) DOMINÓ: someone empties hand, or (b) TRANCAO: all pass in sequence (1v1: 2 passes; 2v2: 4 passes)
- **Pip matching**: Only open ends matter; placement must match one end

### 1.2 Scoring


| Outcome               | Score                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| DOMINÓ (emptied hand) | Opponent(s) remaining pips → winner                                                                  |
| TRANCAO (blocked)     | Lower-total side wins; score = difference in remaining pips. Tie: starter's side wins (0 pts)        |
| CAPICÚA               | +25 bonus when DOMINÓ and both open ends match and final tile is NOT a double and NOT involves blank |
| VEINTICINCO           | +25 when current player forces everyone else to pass (1v1: opponent passes; 2v2: other 3 pass)       |


### 1.3 Seat/Team Model (2v2)

- Seats: N, E, S, W (N-S vs E-W)
- Turn order: N → E → S → W
- "Con tu frente": N teams with S, E teams with W
- VEINTICINCO: "person next to you, teammate in front, person to your left" = in 2v2, the 3 opponents (everyone except you)
- TRANCAO: 4 consecutive passes (one full cycle)

### 1.4 Callout Triggers


| Callout     | Trigger                                          | Behavior                              |
| ----------- | ------------------------------------------------ | ------------------------------------- |
| DOMINÓ      | Player empties hand                              | Full-screen, skippable, sound toggle  |
| TRANCAO     | Table blocks (2/4 passes in row)                 | Same + reveal pip totals, award score |
| VEINTICINCO | Everyone else passes due to your move            | Same + reveal pip totals, award 25    |
| CAPICÚA     | DOMINÓ + both ends match + tile not double/blank | Same + award 25 bonus                 |


### 1.5 UX Flows

- **Create**: Choose Live vs Turn-based, theme, (2v2 later) → generate `game_id`, creator gets invite link
- **Join**: Paste link or enter code → pick nickname + avatar color → join
- **Play**: See hand, board, scores; play/pass; see callouts; quick chat/emotes
- **Rematch**: After round end, "Nueva partida" creates new game with same settings, same players; link shared again

---

## 2. SYSTEM DESIGN

### 2.1 Folder Structure

```
capi/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing: create/join
│   │   ├── game/[id]/page.tsx    # Game UI
│   │   ├── api/
│   │   │   ├── games/
│   │   │   │   ├── route.ts      # POST create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts  # GET game
│   │   │   │       ├── join/route.ts
│   │   │   │       ├── move/route.ts
│   │   │   │       └── rematch/route.ts
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── types.ts
│   │   │   ├── reducer.ts
│   │   │   ├── validate.ts
│   │   │   ├── scoring.ts
│   │   │   └── index.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── realtime.ts           # Live mode subscription
│   ├── components/
│   │   ├── game/
│   │   │   ├── Board.tsx
│   │   │   ├── Hand.tsx
│   │   │   ├── ScorePanel.tsx
│   │   │   ├── CalloutOverlay.tsx
│   │   │   └── QuickChat.tsx
│   │   ├── CreateGameForm.tsx
│   │   └── JoinGameForm.tsx
│   └── hooks/
│       ├── useGameState.ts
│       └── useRealtimeGame.ts
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
├── __tests__/
│   └── engine/
│       ├── reducer.test.ts
│       ├── scoring.test.ts
│       └── validate.test.ts
├── package.json
├── tailwind.config.ts
└── next.config.js
```

### 2.2 Data Model (Supabase Postgres)

```sql
-- games
id uuid PK, created_at, mode (live|turn_based), theme (barberia|colmado|patio),
status (waiting|playing|round_over|finished),
state_version int, -- optimistic concurrency
game_state jsonb,  -- full GameState from engine
settings jsonb     -- { targetScore: 100, is2v2: false }
invite_code text unique, creator_player_id uuid

-- players
id uuid PK, game_id FK, seat (n|e|s|w), nickname text, avatar_color text,
player_index int  -- 0..3 for turn order

-- moves (audit + turn-based poll)
id uuid PK, game_id FK, player_id FK, round_index int,
intent jsonb, result jsonb, created_at

-- chat_emotes (audit only; real-time via Broadcast)
id uuid PK, game_id FK, player_id FK, type (quick_chat|emote),
payload text, created_at
```

`game_state` stores the full `GameState` (hands, board, scores, round index, phase, last callout, etc.).

### 2.3 API Endpoints


| Method | Path                        | Purpose                              |
| ------ | --------------------------- | ------------------------------------ |
| POST   | /api/games                  | Create game                          |
| GET    | /api/games/[id]             | Fetch game (with RLS / invite check) |
| POST   | /api/games/[id]/join        | Join game                            |
| POST   | /api/games/[id]/move        | Submit move (play/pass)              |
| POST   | /api/games/[id]/chat        | Send quick chat or emote             |
| POST   | /api/games/[id]/rematch     | Create rematch game                  |
| POST   | /api/games/[id]/ack-callout | Mark callout seen (optional; for UX) |


### 2.4 Realtime Strategy

- **Supabase Realtime Postgres Changes** on `games` table: on `game_state` update, all clients receive new state.
- **Supabase Realtime Broadcast** for chat/emotes (ephemeral, no persistence required for real-time delivery; we persist for audit).
- Flow: Client → `POST /api/games/[id]/move` → server validates with engine → writes `game_state` to DB → Postgres Changes pushes to subscribers.
- **Concurrency**: `state_version` in `games`. Move handler: `UPDATE games SET game_state = $1, state_version = state_version + 1 WHERE id = $2 AND state_version = $3 RETURNING *`. If no row, return 409 Conflict (client retries).

### 2.5 Turn-based vs Live

- Same engine, same API. Turn-based: client polls or uses Postgres Changes; no difference in server logic.
- Live: clients subscribe to `games:id=XXX` changes; low latency.
- Both: server is authoritative; client sends intents, server applies and persists.

---

## 3. GAME ENGINE DESIGN

### 3.1 Core Types

```typescript
// lib/engine/types.ts

type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Tile = [Pip, Pip]; // e.g. [3, 5]

type Seat = "n" | "e" | "s" | "w";
type GameMode = "live" | "turn_based";
type Theme = "barberia" | "colmado" | "patio";

interface PlayerInfo {
  seat: Seat;
  nickname: string;
  avatarColor: string;
  team: 0 | 1; // N-S=0, E-W=1 for 2v2
}

interface GameState {
  phase: "waiting" | "playing" | "round_over" | "finished";
  mode: GameMode;
  theme: Theme;
  is2v2: boolean;
  targetScore: number;
  scores: [number, number]; // team 0, team 1
  roundIndex: number;
  hands: Record<Seat, Tile[]>; // 4 slots; 1v1 uses n,s only
  board: Tile[]; // linear chain; ends = board[0][0], board[last][1]
  boneyard: Tile[];
  currentTurn: Seat;
  consecutivePasses: number;
  starterThisRound: Seat;
  lastCallout: CalloutType | null;
  lastCalloutPayload: Record<string, unknown> | null;
  players: Record<Seat, PlayerInfo | null>;
  winnerTeam: number | null; // when finished
}

type CalloutType = "domino" | "trancao" | "capicua" | "veinticinco";

interface MoveIntent {
  type: "play" | "pass";
  tile?: Tile; // required if type === 'play'
  end?: "left" | "right"; // required if type === 'play'
}

interface MoveResult {
  success: boolean;
  newState: GameState;
  error?: string;
  callout?: CalloutType;
  calloutPayload?: Record<string, unknown>;
}
```

### 3.2 Reducer Signature

```typescript
function applyMove(
  state: GameState,
  seat: Seat,
  intent: MoveIntent,
): MoveResult;
```

- Pure function. Validates intent, applies state transition, returns new state + optional callout.

### 3.3 Validation Rules

- `play`: tile in hand; tile matches one open end; it's `seat`'s turn.
- `pass`: no tile in hand matches either end; it's `seat`'s turn.
- Reject out-of-turn or invalid tile/end.

### 3.4 Placement

- Board is ordered. Left end = `board[0][0]`, right end = `board[board.length-1][1]`.
- New tile must match one end. If matching both (capicua candidate), still place on one end; after placement, check if both ends equal → CAPICÚA only if round ends by DOMINÓ, tile not double, no blank.

### 3.5 Block Detection

- **1v1**: `consecutivePasses >= 2` → TRANCAO.
- **2v2**: `consecutivePasses >= 4` → TRANCAO.
- On each pass: increment `consecutivePasses`. On play: reset to 0.

### 3.6 VEINTICINCO Detection

- After a **play** (not pass): if the very next turn(s) are all passes until we get back to the same player:
  - 1v1: opponent passes once → VEINTICINCO.
  - 2v2: E, S, W all pass (3 passes) before N's turn again → VEINTICINCO for N.
- Implementation: when current player **plays** and we detect that all others passed in sequence (1 or 3) before turn returns to current player, trigger VEINTICINCO.
- Concretely: track `passesSinceLastPlay`. When someone plays, if `passesSinceLastPlay` equals (is2v2 ? 3 : 1), then last player who played gets VEINTICINCO.

### 3.7 CAPICÚA Logic

- Trigger only when: (1) round ends by DOMINÓ, (2) the winning tile is placed and both open ends have the same pip value, (3) winning tile is not a double, (4) winning tile does not involve blank.
- Check: `tile[0] !== tile[1]` (not double), `tile[0] !== 0 && tile[1] !== 0` (no blank), and after placement `getLeftEnd(state.board) === getRightEnd(state.board)`.

### 3.8 Scoring Logic

- **DOMINÓ**: winning team gets sum of opponent hands' pips.
- **TRANCAO**: compare team pip totals; lower wins; score = difference. Tie → starter's team wins, 0 pts.
- **CAPICÚA**: add 25 to DOMINÓ score.
- **VEINTICINCO**: add 25 when applicable; then add opponent pips (or in blocked case, the normal blocked score). VEINTICINCO can occur mid-round; the 25 is added when the round eventually ends (or we define: VEINTICINCO gives 25 immediately and round continues; per your spec, "reveal pip totals and award score" suggests it might end the round; clarify in Qs).

**Default**: VEINTICINCO ends the round: 25 + opponent(s) remaining pips to the player who caused it. Same flow as DOMINÓ for scoring (everyone else's pips to winner), plus 25.

### 3.9 Unit Test Plan

- Draw and deal correctness (7 each, boneyard remainder)
- Start rule (highest double / highest tile)
- Legal play validation (matching ends, turn order)
- Illegal play/pass rejection
- Pass increments `consecutivePasses`; play resets
- TRANCAO at 2 (1v1) and 4 (2v2) passes
- DOMINÓ scoring
- TRANCAO scoring (difference, tie → starter wins)
- CAPICÚA: valid (non-double, no blank, both ends match on last play)
- CAPICÚA: invalid (double, blank, ends differ)
- VEINTICINCO: 1v1 (one opponent pass after your play)
- VEINTICINCO: 2v2 (three passes before your turn)
- Game to 100 detection
- 2v2 team aggregation and turn order

---

## 4. STEP-BY-STEP IMPLEMENTATION PLAN

### Milestone 1: Project + Engine Core

**Goal**: Working reducer with types, validation, scoring, tests.

- Init Next.js (App Router), TypeScript, Tailwind
- Add Vitest, Supabase client
- Create `lib/engine/types.ts` (Tile, GameState, MoveIntent, MoveResult, etc.)
- Create `lib/engine/reducer.ts` (applyMove)
- Create `lib/engine/validate.ts` (legal move checks)
- Create `lib/engine/scoring.ts` (DOMINÓ, TRANCAO, CAPICÚA, VEINTICINCO)
- Tests: draw, start rule, play/pass, block, scoring, callouts

**Files**: `src/lib/engine/*`, `__tests__/engine/*`, `package.json`, `vitest.config.ts`

---

### Milestone 2: Supabase + Turn-based E2E

**Goal**: Create game, join, play full 1v1 turn-based round via API.

- Supabase project, migration: `games`, `players`, `moves`
- API: POST /api/games, GET /api/games/[id], POST join, POST move
- Move handler: load state, applyMove, write back with `state_version`
- Minimal UI: create form, join form, game page (hand + board + play/pass)
- Client: fetch game, submit move, refetch (or simple poll) after move

**Files**: `supabase/migrations/`, `src/app/api/`, `src/app/page.tsx`, `src/app/game/[id]/page.tsx`, basic components

---

### Milestone 3: Live Realtime Layer

**Goal**: Same game works in Live mode with Supabase Realtime.

- Subscribe to `games:id=X` Postgres changes
- `useRealtimeGame` hook: merge server state into local state
- Create-game form: mode selector (live vs turn_based)
- Optimistic UI optional; prefer server state as source of truth

**Files**: `src/lib/realtime.ts`, `src/hooks/useRealtimeGame.ts`, create form updates

---

### Milestone 4: Callouts + Polish

**Goal**: Full-screen skippable callouts, sound toggle, theme selector, and gameplay/UI polish.

#### Callouts & Sound
- `CalloutOverlay` component: DOMINÓ, TRANCAO, CAPICÚA, VEINTICINCO
- Sound effects (mp3) + toggle (localStorage)
- Theme tokens: barberia, colmado, patio (subtle textures/accent colors)
- Game creation: theme picker

#### Gameplay Feel
- Draw animation: reveal tiles one at a time with ~300ms delay instead of all at once
- Draw feedback: show "Drew N tiles" message so opponent understands what happened
- Tile placement animation: slide tile onto the board
- Turn indicator: clear visual pulse/highlight when it's your turn

#### Visual / UI
- Board layout: wrap/bend the chain at edges like a real domino table
- Tile design: dot pips instead of numbers, divider line, rounded corners
- Opponent hand: show face-down tile backs instead of just a text count
- Mobile responsiveness: hand and board scaling on smaller screens

#### Game Flow
- Round transition: "Next Round" button after round_over
- Game over screen: celebratory finish with final stats
- Sound effects: tile slam, draw sound, callout jingles

**Files**: `src/components/game/CalloutOverlay.tsx`, `public/sounds/`, `tailwind.config.ts`, CSS variables

---

### Milestone 5: Quick Chat + Emotes

**Goal**: Buttons and emotes, persisted + Broadcast for live.

- `chat_emotes` table, POST /api/games/[id]/chat
- Broadcast channel for chat/emotes in live mode
- `QuickChat` component: 6 phrases + 5 emotes
- Display chat/emote in game UI (minimal bubble or toast)

**Files**: `src/components/game/QuickChat.tsx`, `src/app/api/games/[id]/chat/route.ts`, migration for chat_emotes

---

### Milestone 6: 2v2

**Goal**: Con tu frente, 4 seats, team scoring, TRANCAO/VEINTICINCO for 4 players.

- Engine: `is2v2`, 4 hands, N-S vs E-W, 4-pass TRANCAO, 3-pass VEINTICINCO
- Join flow: pick seat or assign
- UI: 4 hand areas, team scores
- Tests for 2v2 scoring and block/VEINTICINCO

**Files**: `lib/engine/*`, `src/components/game/*`, `__tests__/engine/*`

---

### Milestone 7: Rematch + Invite UX

**Goal**: "Nueva partida" and smooth invite flow.

- POST /api/games/[id]/rematch → new game, same settings
- Share link / copy invite
- Optional: `ack-callout` to sync "seen" state (low priority)

**Files**: `src/app/api/games/[id]/rematch/route.ts`, game-over UI

---

## 5. RISKS & GOTCHAS

### 5.1 Turn Enforcement

- **Risk**: Client sends move out of turn; replay of same move.
- **Mitigation**: Server checks `state.currentTurn === seat` and `intent` validity. Idempotency: same move + same state_version could return 200 with current state (no double-apply).

### 5.2 Concurrency (Stale Updates)

- **Risk**: Two browsers submit moves; last write wins.
- **Mitigation**: `state_version` optimistic locking. 409 → client refetches and retries.

### 5.3 Block / VEINTICINCO Order

- **Risk**: Is it TRANCAO or VEINTICINCO when the last pass completes a full cycle?
- **Rule**: TRANCAO = everyone passed, no one can play. VEINTICINCO = you play, everyone else passes, you get another turn. They're exclusive: if 4 passes in a row with no play in between, it's TRANCAO. If you play and then 3 others pass, it's VEINTICINCO (your turn again, you play or pass).
- **Test**: Explicit scenarios for both.

### 5.4 Scoring Edge Cases

- **Tranque tie**: Starter's team wins, 0 pts.
- **Capicua + double/blank**: No bonus; DOMINÓ score only.
- **VEINTICINCO + DOMINÓ**: 25 + pips. If VEINTICINCO ends the round (everyone passed), treat as round end: 25 + opponent pips.

### 5.5 Realtime Delivery

- **Risk**: Missed Postgres change (client disconnect).
- **Mitigation**: Client refetches on reconnect; use `state_version` to detect stale and overwrite.

---

## 6. Clarifications Needed

Before implementation, a few choices that affect logic:

1. **VEINTICINCO timing**: Does VEINTICINCO end the round immediately (score 25 + opponent pips and start new round), or does the player who caused it get another turn and the round continues until DOMINÓ/TRANCAO? *(Default: ends round immediately, like DOMINÓ)*
2. **Rematch**: Does rematch require all original players to re-join, or can new players fill empty seats? *(Default: same players; new game link shared, first to join gets their prior seat)*
3. **First hand in 2v2**: Who gets the first 7 tiles, only N and E (opponents), or all 4? *(Default: all 4 draw 7; N starts, so N and E have 7 each, S and W have 7 each)*
