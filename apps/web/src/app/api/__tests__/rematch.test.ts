import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { POST as rematch } from "../games/[id]/rematch/route";
import { POST as join } from "../games/[id]/join/route";

let db: FakeDb;
let finished: Seeded;

// A 1v1 that ended with a domino: the finished row keeps the round's callout.
beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
  finished = seedPlaying(db, { version: 9 });
  const row = db.row("games", finished.game.id)!;
  row.status = "finished";
  row.game_state = {
    ...row.game_state,
    phase: "finished",
    winnerTeam: 0,
    lastCallout: "domino",
    lastCalloutPayload: { type: "domino", seat: "n", team: 0, points: 23 },
  };
});

async function ask(playerId: string) {
  const id = finished.game.id;
  const res = await rematch(post(`/api/games/${id}/rematch`, { playerId }), params(id));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/games/[id]/rematch", () => {
  it("links the new table without replaying the final callout", async () => {
    const res = await ask(finished.players.n.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ seat: "n", waiting: true });
    const old = db.row("games", finished.game.id)!;
    expect(old.state_version).toBe(10);
    expect(old.game_state.rematchGameId).toBe(res.body.gameId);
    expect(old.game_state.lastCallout).toBeNull();
    // The score summary still has what it needs.
    expect(old.game_state.lastCalloutPayload).toMatchObject({ type: "domino", points: 23 });
  });

  it("is idempotent for the same player and seats each original player in their own seat", async () => {
    const first = await ask(finished.players.n.id);
    const again = await ask(finished.players.n.id);
    expect(again.body).toMatchObject({ gameId: first.body.gameId, playerId: first.body.playerId, seat: "n" });

    const other = await ask(finished.players.s.id);
    expect(other.status).toBe(200);
    expect(other.body).toMatchObject({ gameId: first.body.gameId, seat: "s", waiting: false });
    expect(other.body.playerId).not.toBe(first.body.playerId);
    expect(db.row("games", first.body.gameId)).toMatchObject({ status: "playing", state_version: 1 });
  });

  it("seats two players with the same name and color in their own seats and starts", async () => {
    // Both phones typed "Yo" and kept the app's default color.
    for (const seat of ["n", "s"]) {
      Object.assign(db.row("players", finished.players[seat].id)!, { nickname: "Yo", avatar_color: "#6366f1" });
    }
    const north = await ask(finished.players.n.id);
    const south = await ask(finished.players.s.id);
    expect(south.status).toBe(200);
    expect(south.body).toMatchObject({ gameId: north.body.gameId, seat: "s", waiting: false });
    expect(south.body.playerId).not.toBe(north.body.playerId);
    expect(db.row("games", north.body.gameId)).toMatchObject({ status: "playing", state_version: 1 });
    // Retries stay idempotent for both.
    expect((await ask(finished.players.n.id)).body).toMatchObject({ playerId: north.body.playerId, seat: "n" });
    expect((await ask(finished.players.s.id)).body).toMatchObject({ playerId: south.body.playerId, seat: "s" });
  });

  it("in 2v2 never hands a twin the row of the other twin a newcomer displaced", async () => {
    const table2v2 = seedPlaying(db, { version: 9, is2v2: true });
    const row = db.row("games", table2v2.game.id)!;
    row.status = "finished";
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
    for (const seat of ["n", "s"]) {
      Object.assign(db.row("players", table2v2.players[seat].id)!, { nickname: "Yo", avatar_color: "#6366f1" });
    }
    const ask2 = async (playerId: string) => {
      const id = table2v2.game.id;
      const res = await rematch(post(`/api/games/${id}/rematch`, { playerId }), params(id));
      return { status: res.status, body: await res.json() };
    };

    const east = await ask2(table2v2.players.e.id);
    const table = east.body.gameId as string;
    const joined = await join(
      post(`/api/games/${table}/join`, { nickname: "Newcomer", avatarColor: "#3b82f6" }),
      params(table)
    );
    expect((await joined.json()).seat).toBe("n");
    // North's seat is taken and south's is a twin seat, so north gets west.
    const north = await ask2(table2v2.players.n.id);
    expect(north.body).toMatchObject({ gameId: table, seat: "w" });

    const south = await ask2(table2v2.players.s.id);
    expect(south.status).toBe(200);
    expect(south.body).toMatchObject({ gameId: table, seat: "s", waiting: false });
    expect(south.body.playerId).not.toBe(north.body.playerId);
    expect(db.row("games", table)).toMatchObject({ status: "playing" });
    // North's retry stays idempotent.
    expect((await ask2(table2v2.players.n.id)).body).toMatchObject({ playerId: north.body.playerId, seat: "w" });
  });

  it("never hands an original player the seat a newcomer took first", async () => {
    const opened = await ask(finished.players.n.id);
    const newGameId = opened.body.gameId;
    const joined = await join(
      post(`/api/games/${newGameId}/join`, { nickname: "Newcomer", avatarColor: "#3b82f6" }),
      params(newGameId)
    );
    const newcomer = await joined.json();
    expect(newcomer.seat).toBe("s");

    const res = await ask(finished.players.s.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Game is full" });
    expect(JSON.stringify(res.body)).not.toContain(newcomer.playerId);
  });

  it("answers a failed arrival at the linked table with a 500 and keeps the link", async () => {
    const opened = await ask(finished.players.n.id);
    const table = opened.body.gameId as string;
    // One read of the linked table fails (a timeout); supabase-js returns it.
    let failed = false;
    db.intercept = (call) => {
      const byId = call.filters.find(([c]) => c === "id")?.[1];
      if (!failed && call.table === "games" && call.op === "select" && byId === table) {
        failed = true;
        return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
      }
      return undefined;
    };
    const res = await ask(finished.players.s.id);
    expect(res).toEqual({ status: 500, body: { error: "Failed to create rematch" } });
    expect(db.row("games", finished.game.id)!.game_state.rematchGameId).toBe(table);
    expect(db.tables.games.filter((g) => g.status === "waiting")).toHaveLength(1);
    // The retry seats south at the same table, which then starts.
    const retry = await ask(finished.players.s.id);
    expect(retry.body).toMatchObject({ gameId: table, seat: "s", waiting: false });
  });

  it("refuses a game that is not finished", async () => {
    const live = seedPlaying(db);
    const res = await rematch(
      post(`/api/games/${live.game.id}/rematch`, { playerId: live.players.n.id }),
      params(live.game.id)
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Game is not finished");
  });
});
