import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb, get, params, post } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report";
import { POST as create } from "../games/route";
import { POST as join } from "../games/[id]/join/route";
import { POST as rematch } from "../games/[id]/rematch/route";
import { GET as getGame } from "../games/[id]/route";

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
  vi.mocked(reportError).mockClear();
});

async function createGame(body: Record<string, unknown>) {
  const res = await create(post("/api/games", { nickname: "Ana", ...body }));
  return res.json();
}

function joinAs(gameId: string, nickname: string) {
  return join(post(`/api/games/${gameId}/join`, { nickname, avatarColor: "#10b981" }), params(gameId));
}

describe("POST /api/games mode", () => {
  it("keeps the column default (turn_based) when no mode is sent", async () => {
    const { gameId } = await createGame({});
    expect(db.row("games", gameId)?.mode).toBe("turn_based");
  });

  it("makes a live table when the client asks for one (web form, apps)", async () => {
    const { gameId } = await createGame({ mode: "live" });
    expect(db.row("games", gameId)?.mode).toBe("live");
  });

  it("keeps turn_based from create through the deal and the rematch", async () => {
    const { gameId, playerId } = await createGame({ mode: "turn_based" });
    expect(db.row("games", gameId)?.mode).toBe("turn_based");
    await joinAs(gameId, "Beto");
    expect(db.row("games", gameId)?.game_state.mode).toBe("turn_based");

    const row = db.row("games", gameId)!;
    row.status = "finished";
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
    const res = await rematch(post(`/api/games/${gameId}/rematch`, { playerId }), params(gameId));
    const { gameId: nextId } = await res.json();
    expect(db.row("games", nextId)?.mode).toBe("turn_based");
  });
});

describe("POST /api/games/[id]/join", () => {
  it("seats simultaneous joiners in the free seats and starts the full table once", async () => {
    const { gameId } = await createGame({ is2v2: true });
    const results = await Promise.all(["Beto", "Caro", "Dani"].map((n) => joinAs(gameId, n)));
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(bodies.map((b) => b.seat).sort()).toEqual(["e", "s", "w"]);
    expect(db.row("games", gameId)).toMatchObject({ status: "playing", state_version: 1 });
    const starts = db.calls.filter((c) => c.table === "games" && c.op === "update");
    expect(starts.length).toBeGreaterThanOrEqual(1);
  });

  it("answers a failed players read with a reported 500, not 'Game has no host'", async () => {
    const { gameId } = await createGame({});
    db.intercept = (call) =>
      call.table === "players" && call.op === "select"
        ? { data: null, error: { code: "57014", message: "statement timeout" } }
        : undefined;
    const res = await joinAs(gameId, "Luis");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to join game" });
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("says the table is full only when no seat is left", async () => {
    const { gameId } = await createGame({});
    const [a, b] = await Promise.all([joinAs(gameId, "Beto"), joinAs(gameId, "Caro")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? await a.json() : await b.json();
    expect(loser).toEqual({ error: "Game is full" });
  });
});

describe("GET /api/games/[id]", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  async function read(error?: { code: string; message: string }) {
    if (error) {
      db.intercept = (call) => (call.table === "games" ? { data: null, error } : undefined);
    }
    const res = await getGame(get(`/api/games/${id}`), params(id));
    return { status: res.status, body: await res.json() };
  }

  it("is 404 when the game does not exist", async () => {
    expect((await read()).status).toBe(404);
    expect((await read({ code: "PGRST116", message: "no rows" })).status).toBe(404);
    expect((await read({ code: "22P02", message: "invalid input syntax for type uuid" })).status).toBe(404);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("is 500 and reported when the database fails, so clients keep the saved seat", async () => {
    const res = await read({ code: "", message: "FetchError: fetch failed" });
    expect(res).toEqual({ status: 500, body: { error: "Internal server error" } });
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
