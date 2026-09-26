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
