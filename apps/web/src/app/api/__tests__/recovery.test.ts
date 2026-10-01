import { beforeEach, describe, expect, it, vi } from "vitest";
import { startNewRound, type GameState } from "@capi/engine";
import { FakeDb, get, legalIntent, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { POST as create } from "../games/route";
import { GET as getGame } from "../games/[id]/route";
import { POST as join } from "../games/[id]/join/route";
import { POST as move } from "../games/[id]/move/route";
import { POST as nextRound } from "../games/[id]/next-round/route";
import { POST as claim } from "../games/[id]/claim/route";
import { POST as rematch } from "../games/[id]/rematch/route";

// Every way a table could be left where no route moves it forward: a write
// that commits but loses its answer, a start write that fails, a client that
// missed another seat's write. Each must end in a table someone can play.

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
});

async function body(res: Response) {
  return { status: res.status, body: await res.json() };
}

// The next update on `table` commits but answers an error, like a reset
// connection between Vercel and PostgREST after the database wrote the row.
function loseNextUpdateAnswer(table: string) {
  let done = false;
  db.intercept = (call) => {
    if (done || call.table !== table || call.op !== "update") return undefined;
    done = true;
    const id = call.filters.find(([c]) => c === "id")?.[1];
    const row = db.row(table, id as string);
    if (row) Object.assign(row, structuredClone(call.values));
    return { data: null, error: { code: "08006", message: "connection failure" } };
  };
}

// The next update on `table` fails without writing anything.
function failNextUpdate(table: string) {
  let done = false;
  db.intercept = (call) => {
    if (done || call.table !== table || call.op !== "update") return undefined;
    done = true;
    return { data: null, error: { code: "57014", message: "statement timeout" } };
  };
}

describe("a full table that never started", () => {
  it("is dealt by the next GET when the last join lost its start write", async () => {
    const created = await (await create(post("/api/games", { nickname: "Ana", mode: "live" }))).json();
    failNextUpdate("games");
    const joined = await body(await join(post(`/api/games/${created.gameId}/join`, { nickname: "Beto" }), params(created.gameId)));
    // The seat is kept and answered, never a 500 the client would retry
    // into "Game is full".
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ seat: "s", gameId: created.gameId });
    expect(db.row("games", created.gameId)).toMatchObject({ status: "waiting", state_version: 0 });

    const res = await body(await getGame(get(`/api/games/${created.gameId}`), params(created.gameId)));
    expect(res.body.game).toMatchObject({ status: "playing", state_version: 1 });
    expect(res.body.game.game_state.phase).toBe("playing");
    expect(db.row("games", created.gameId)).toMatchObject({ status: "playing", state_version: 1 });
  });

  it("is dealt when someone tries to join it", async () => {
    const created = await (await create(post("/api/games", { nickname: "Ana", mode: "live" }))).json();
    db.insertRow("players", { game_id: created.gameId, seat: "s", nickname: "Beto", avatar_color: "#10b981" });
    const late = await body(await join(post(`/api/games/${created.gameId}/join`, { nickname: "Caro" }), params(created.gameId)));
    expect(late).toEqual({ status: 409, body: { error: "Game is full" } });
    expect(db.row("games", created.gameId)).toMatchObject({ status: "playing", state_version: 1 });
  });

  it("gives the joiner the seat when the insert committed but its answer was lost", async () => {
    const created = await (await create(post("/api/games", { nickname: "Ana", mode: "turn_based" }))).json();
    let lost = false;
    db.intercept = (call) => {
      if (lost || call.table !== "players" || call.op !== "insert") return undefined;
      lost = true;
      db.insertRow("players", structuredClone(call.values as Record<string, unknown>));
      return { data: null, error: { code: "", message: "FetchError: socket hang up" } };
    };
    const joined = await body(
      await join(post(`/api/games/${created.gameId}/join`, { nickname: "Beto", avatarColor: "#10b981" }), params(created.gameId))
    );
    expect(joined.status).toBe(200);
    const row = db.tables.players.find((p) => p.seat === "s")!;
    expect(joined.body).toMatchObject({ playerId: row.id, seat: "s" });
    expect(db.row("games", created.gameId)).toMatchObject({ status: "playing", state_version: 1 });
  });

  it("hands the seat back to a joiner who retries after the dealing join's answer was lost", async () => {
    const created = await (await create(post("/api/games", { nickname: "Ana", mode: "turn_based" }))).json();
    const first = await body(
      await join(post(`/api/games/${created.gameId}/join`, { nickname: "Beto", avatarColor: "#10b981" }), params(created.gameId))
    );
    // The device never saw `first`. It asks again with the same name.
    const retry = await body(
      await join(post(`/api/games/${created.gameId}/join`, { nickname: "Beto", avatarColor: "#10b981" }), params(created.gameId))
    );
    expect(retry).toEqual({ status: 200, body: { playerId: first.body.playerId, seat: "s", gameId: created.gameId } });
    // Someone else still cannot join a started table.
    const other = await body(
      await join(post(`/api/games/${created.gameId}/join`, { nickname: "Caro", avatarColor: "#10b981" }), params(created.gameId))
    );
    expect(other).toEqual({ status: 409, body: { error: "Game already started" } });
    // And once a move is made, the window closes.
    db.row("games", created.gameId)!.state_version = 2;
    const late = await body(
      await join(post(`/api/games/${created.gameId}/join`, { nickname: "Beto", avatarColor: "#10b981" }), params(created.gameId))
    );
    expect(late.status).toBe(409);
  });

  it("leaves a table with a free seat waiting", async () => {
    const created = await (await create(post("/api/games", { nickname: "Ana", mode: "live" }))).json();
    const res = await body(await getGame(get(`/api/games/${created.gameId}`), params(created.gameId)));
    expect(res.body.game).toMatchObject({ status: "waiting", state_version: 0 });
  });
});

describe("rematch with a lost answer", () => {
  let finished: Seeded;
  beforeEach(() => {
    finished = seedPlaying(db, { version: 9 });
    const row = db.row("games", finished.game.id)!;
    row.status = "finished";
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
  });

  it("keeps the table its own link names, and the next seat arrives there", async () => {
    const id = finished.game.id;
    loseNextUpdateAnswer("games");
    const first = await body(await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.n.id }), params(id)));
    expect(first.status).toBe(200);
    const linked = db.row("games", id)!.game_state.rematchGameId;
    expect(first.body.gameId).toBe(linked);
    expect(db.row("games", linked)).toBeTruthy();

    const second = await body(await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.s.id }), params(id)));
    expect(second.body).toMatchObject({ gameId: linked, seat: "s", waiting: false });
    expect(db.row("games", linked)).toMatchObject({ status: "playing", state_version: 1 });
  });

  it("keeps its table when the read after a lost link answer fails too", async () => {
    const id = finished.game.id;
    let step = 0;
    db.intercept = (call) => {
      const byId = call.filters.find(([c]) => c === "id")?.[1];
      if (call.table !== "games" || byId !== id) return undefined;
      if (step === 0 && call.op === "update") {
        step = 1;
        Object.assign(db.row("games", id)!, structuredClone(call.values));
        return { data: null, error: { code: "", message: "FetchError" } };
      }
      if (step === 1 && call.op === "select") {
        step = 2;
        return { data: null, error: { code: "57014", message: "statement timeout" } };
      }
      return undefined;
    };
    const first = await body(await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.n.id }), params(id)));
    expect(first.status).toBe(500);
    const linked = db.row("games", id)!.game_state.rematchGameId;
    expect(db.row("games", linked)).toBeTruthy();
    // Both retries arrive at the kept table, which then starts.
    const again = await body(await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.n.id }), params(id)));
    expect(again.body).toMatchObject({ gameId: linked, seat: "n" });
    const second = await body(await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.s.id }), params(id)));
    expect(second.body).toMatchObject({ gameId: linked, seat: "s", waiting: false });
  });

  it("pushes the link to the chat channel", async () => {
    const id = finished.game.id;
    await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players.n.id }), params(id));
    const sent = db.broadcasts.filter((b) => b.topic === `chat-${id}`);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload.gameState.rematchGameId).toBe(db.row("games", id)!.game_state.rematchGameId);
    expect(sent[0].payload.stateVersion).toBe(10);
  });
});

describe("next round", () => {
  let seeded: Seeded;
  // A 1v1 whose round just ended on a dominó.
  beforeEach(() => {
    seeded = seedPlaying(db, { version: 5 });
    const row = db.row("games", seeded.game.id)!;
    row.status = "round_over";
    row.game_state = {
      ...row.game_state,
      phase: "round_over",
      scores: [30, 0],
      lastCallout: "domino",
      lastPlayedBy: "n",
      lastCalloutPayload: { winningTeam: 0, team0Pips: 0, team1Pips: 30, pipsAwarded: 30 },
    };
  });

  const deal = (stateVersion: number, playerId = seeded.players.s.id) =>
    nextRound(post(`/api/games/${seeded.game.id}/next-round`, { playerId, stateVersion }), params(seeded.game.id));

  it("deals, and pushes the deal to the chat channel", async () => {
    const res = await body(await deal(5));
    expect(res.status).toBe(200);
    expect(db.row("games", seeded.game.id)).toMatchObject({ status: "playing", state_version: 6 });
    expect(db.broadcasts).toHaveLength(1);
    expect(db.broadcasts[0]).toMatchObject({ topic: `chat-${seeded.game.id}`, event: "state" });
    expect(db.broadcasts[0].payload).toMatchObject({ stateVersion: 6, callout: null });
    expect(db.broadcasts[0].payload.gameState).toMatchObject({ phase: "playing", roundIndex: 1, currentTurn: "n" });
  });

  it("tells a client that missed another seat's deal that it is stale", async () => {
    await deal(5, seeded.players.n.id);
    const late = await body(await deal(5));
    expect(late).toEqual({ status: 409, body: { error: "State is stale - refetch", stale: true } });
  });

  it("never writes 'playing' over a state the engine did not deal", async () => {
    const row = db.row("games", seeded.game.id)!;
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
    const res = await body(await deal(5));
    expect(res.status).toBe(409);
    expect(db.row("games", seeded.game.id)).toMatchObject({ status: "round_over", state_version: 5 });
  });
});

describe("claim", () => {
  let seeded: Seeded;
  beforeEach(() => {
    seeded = seedPlaying(db, { version: 3 });
    const row = db.row("games", seeded.game.id)!;
    // North has been silent on turn for five minutes.
    row.game_state = { ...row.game_state, currentTurn: "n", lastMoveAt: new Date(Date.now() - 300_000).toISOString() };
  });

  it("answers a claimer holding an old version with stale, and changes nothing", async () => {
    const id = seeded.game.id;
    const res = await body(await claim(post(`/api/games/${id}/claim`, { playerId: seeded.players.s.id, stateVersion: 2 }), params(id)));
    expect(res).toEqual({ status: 409, body: { error: "State is stale - refetch", stale: true } });
    expect(db.row("games", id)).toMatchObject({ status: "playing", state_version: 3 });
  });

  it("ends the game for a current claimer and pushes the end to the chat channel", async () => {
    const id = seeded.game.id;
    const res = await body(await claim(post(`/api/games/${id}/claim`, { playerId: seeded.players.s.id, stateVersion: 3 }), params(id)));
    expect(res.status).toBe(200);
    expect(db.row("games", id)).toMatchObject({ status: "finished", state_version: 4 });
    expect(db.broadcasts.map((b) => b.payload.gameState.phase)).toEqual(["finished"]);
  });
});

describe("a move whose answer is lost", () => {
  it("answers the mover stale and pushes the committed state to the other seats", async () => {
    const seeded = seedPlaying(db, { version: 1 });
    const id = seeded.game.id;
    const state = db.row("games", id)!.game_state as GameState;
    const seat = state.currentTurn;
    loseNextUpdateAnswer("games");
    const res = await body(
      await move(post(`/api/games/${id}/move`, { playerId: seeded.players[seat].id, seat, intent: legalIntent(state), stateVersion: 1 }), params(id))
    );
    expect(res).toEqual({ status: 409, body: { error: "State conflict - refetch", stale: true } });
    expect(db.row("games", id)!.state_version).toBe(2);
    expect(db.broadcasts).toHaveLength(1);
    expect(db.broadcasts[0].payload.stateVersion).toBe(2);
  });
});

// startNewRound is what next-round deals with; this keeps the import honest
// if the engine ever renames it.
void startNewRound;
