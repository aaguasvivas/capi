import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { POST as create } from "../games/route";
import { POST as join } from "../games/[id]/join/route";
import { POST as rematch } from "../games/[id]/rematch/route";

// A seat keeps the player's premium tile design (migration 007) so the other
// seats can draw its backs. Only a premium id is stored, and a body without
// one inserts exactly the columns older clients always inserted: an older
// app, the web, and a database without the column all behave as before.

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
});

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

async function createGame(extra: Record<string, unknown> = {}) {
  return (await json(await create(post("/api/games", { nickname: "Ana", avatarColor: "#6366f1", ...extra })))).body;
}

function joinAs(gameId: string, extra: Record<string, unknown> = {}) {
  return join(
    post(`/api/games/${gameId}/join`, { nickname: "Beto", avatarColor: "#10b981", ...extra }),
    params(gameId)
  );
}

const playerInserts = () => db.calls.filter((c) => c.table === "players" && c.op === "insert");
const playerWrites = () => db.calls.filter((c) => c.table === "players" && c.op !== "select");

// Sent by no client, but each must be read as "no premium design".
const NOT_PREMIUM: Array<[string, Record<string, unknown>]> = [
  ["clasico", { tileSkin: "clasico" }],
  ["an unknown id", { tileSkin: "oro" }],
  ["a non-string", { tileSkin: 7 }],
  ["no field", {}],
];

describe("POST /api/games tileSkin", () => {
  it("stores a premium design on the host's seat", async () => {
    const { playerId } = await createGame({ tileSkin: "kingston" });
    expect(db.row("players", playerId)?.tile_skin).toBe("kingston");
  });

  it.each(NOT_PREMIUM)("sends no tile_skin key for %s", async (_label, extra) => {
    const { gameId, playerId } = await createGame(extra);
    expect(db.row("players", playerId)).not.toHaveProperty("tile_skin");
    expect(playerInserts()[0].values).toEqual({
      game_id: gameId,
      seat: "n",
      nickname: "Ana",
      avatar_color: "#6366f1",
    });
  });
});

describe("POST /api/games/[id]/join tileSkin", () => {
  it("stores a premium design on the joiner's seat", async () => {
    const { gameId } = await createGame();
    const { body } = await json(await joinAs(gameId, { tileSkin: "borinquen" }));
    expect(db.row("players", body.playerId)?.tile_skin).toBe("borinquen");
  });

  it.each(NOT_PREMIUM)("sends no tile_skin key for %s", async (_label, extra) => {
    const { gameId } = await createGame();
    const { body } = await json(await joinAs(gameId, extra));
    expect(db.row("players", body.playerId)).not.toHaveProperty("tile_skin");
    expect(playerInserts()[1].values).toEqual({
      game_id: gameId,
      seat: "s",
      nickname: "Beto",
      avatar_color: "#10b981",
    });
  });

  it("hands the seat back on a retry with another design and leaves the row as it was", async () => {
    const { gameId } = await createGame();
    const first = await json(await joinAs(gameId, { tileSkin: "borinquen" }));
    const before = structuredClone(db.row("players", first.body.playerId));
    const writes = playerWrites().length;

    for (const extra of [{ tileSkin: "kingston" }, {}]) {
      const retry = await json(await joinAs(gameId, extra));
      expect(retry).toEqual({ status: 200, body: { playerId: first.body.playerId, seat: "s", gameId } });
    }
    expect(db.row("players", first.body.playerId)).toEqual(before);
    expect(playerWrites()).toHaveLength(writes);
  });

  it("finds its own row after a lost insert answer by name and color alone", async () => {
    const { gameId } = await createGame();
    let lost = false;
    db.intercept = (call) => {
      if (lost || call.table !== "players" || call.op !== "insert") return undefined;
      lost = true;
      db.insertRow("players", structuredClone(call.values as Record<string, unknown>));
      return { data: null, error: { code: "", message: "FetchError: socket hang up" } };
    };
    const joined = await json(await joinAs(gameId, { tileSkin: "quisqueya" }));
    const row = db.tables.players.find((p) => p.seat === "s")!;
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ playerId: row.id, seat: "s" });
    expect(row.tile_skin).toBe("quisqueya");
    expect(playerInserts()).toHaveLength(2);
  });
});

describe("POST /api/games/[id]/rematch tileSkin", () => {
  let finished: Seeded;

  beforeEach(() => {
    finished = seedPlaying(db, { version: 9 });
    const row = db.row("games", finished.game.id)!;
    row.status = "finished";
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
    db.row("players", finished.players.n.id)!.tile_skin = "quisqueya";
  });

  async function ask(seat: "n" | "s", extra: Record<string, unknown> = {}) {
    const id = finished.game.id;
    const res = await rematch(post(`/api/games/${id}/rematch`, { playerId: finished.players[seat].id, ...extra }), params(id));
    return json(res);
  }

  it("copies the original seat's design, and a seat without one gets no key", async () => {
    const north = await ask("n");
    const south = await ask("s");
    expect(db.row("players", north.body.playerId)?.tile_skin).toBe("quisqueya");
    expect(db.row("players", south.body.playerId)).not.toHaveProperty("tile_skin");
    expect(db.row("games", north.body.gameId)).toMatchObject({ status: "playing" });
  });

  it("takes a premium design from the body over the original seat's", async () => {
    const north = await ask("n", { tileSkin: "kingston" });
    const south = await ask("s", { tileSkin: "borinquen" });
    expect(db.row("players", north.body.playerId)?.tile_skin).toBe("kingston");
    expect(db.row("players", south.body.playerId)?.tile_skin).toBe("borinquen");
  });

  it("falls back to the original seat's design when the body names no premium one", async () => {
    const north = await ask("n", { tileSkin: "clasico" });
    const south = await ask("s", { tileSkin: "oro" });
    expect(db.row("players", north.body.playerId)?.tile_skin).toBe("quisqueya");
    expect(db.row("players", south.body.playerId)).not.toHaveProperty("tile_skin");
  });

  it("writes nothing on an idempotent retry", async () => {
    const first = await ask("n");
    const writes = playerWrites().length;
    const again = await ask("n", { tileSkin: "kingston" });
    expect(again.body).toMatchObject({ playerId: first.body.playerId, seat: "n" });
    expect(db.row("players", first.body.playerId)?.tile_skin).toBe("quisqueya");
    expect(playerWrites()).toHaveLength(writes);
  });
});
