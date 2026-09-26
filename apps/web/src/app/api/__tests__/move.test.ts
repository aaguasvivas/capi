import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorKeyFor } from "@capi/i18n";
import { FakeDb, legalIntent, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report";
import { POST } from "../games/[id]/move/route";

let db: FakeDb;
let seeded: Seeded;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
  seeded = seedPlaying(db, { version: 5 });
  vi.mocked(reportError).mockClear();
});

function openingMove(stateVersion = 5) {
  const seat = seeded.state.currentTurn;
  return { playerId: seeded.players[seat].id, seat, intent: legalIntent(seeded.state), stateVersion };
}

async function move(body: unknown) {
  const res = await POST(post(`/api/games/${seeded.game.id}/move`, body), params(seeded.game.id));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/games/[id]/move", () => {
  it("applies a legal move with a write conditioned on the client's version", async () => {
    const res = await move(openingMove());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, stateVersion: 6, callout: null, calloutPayload: null });
    const seat = seeded.state.currentTurn;
    expect(res.body.gameState.hands[seat].length).not.toBe(seeded.state.hands[seat].length);
    const update = db.calls.find((c) => c.table === "games" && c.op === "update");
    expect(update?.filters).toContainEqual(["state_version", 5]);
    expect(db.row("games", seeded.game.id)?.state_version).toBe(6);
  });

  it("answers stale first when the round ended behind the client's back", async () => {
    // The client still thinks it is playing at version 5; the round ended
    // (or a claim finished the game) at version 6.
    const row = db.row("games", seeded.game.id)!;
    row.status = "round_over";
    row.state_version = 6;
    const res = await move(openingMove(5));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "State is stale - refetch", stale: true });
  });

  it("still refuses a table that is not in play when the client is current", async () => {
    db.row("games", seeded.game.id)!.status = "round_over";
    const res = await move(openingMove(5));
    expect(res.status).toBe(409);
    expect(res.body.stale).toBeUndefined();
    expect(errorKeyFor(res.body.error)).toBe("errNotInPlay");
  });

  it("refuses a seat that is not the player's", async () => {
    const body = openingMove();
    const other = body.seat === "n" ? "s" : "n";
    const res = await move({ ...body, playerId: seeded.players[other].id });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Seat mismatch");
  });

  it("passes engine refusals through as a mapped error", async () => {
    const body = openingMove();
    const other = body.seat === "n" ? "s" : "n";
    const res = await move({ ...body, seat: other, playerId: seeded.players[other].id });
    expect(res.status).toBe(422);
    expect(errorKeyFor(res.body.error)).toBe("errNotYourTurn");
  });

  it("answers stale when another request won the race for the version", async () => {
    db.intercept = (call) => {
      if (call.table !== "games" || call.op !== "update") return undefined;
      db.row("games", seeded.game.id)!.state_version = 6;
      return { data: null, error: { code: "PGRST116", message: "no rows" } };
    };
    const res = await move(openingMove());
    expect(res.status).toBe(409);
    expect(res.body.stale).toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a refused write instead of sending the client into a refetch loop", async () => {
    db.lockWrites = true;
    const res = await move(openingMove());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(db.row("games", seeded.game.id)?.state_version).toBe(5);
  });

  it("is a 500, not a 404, when the database fails", async () => {
    db.intercept = (call) =>
      call.table === "games" && call.op === "select"
        ? { data: null, error: { code: "", message: "FetchError: fetch failed" } }
        : undefined;
    const res = await move(openingMove());
    expect(res.status).toBe(500);
    expect(reportError).toHaveBeenCalled();
  });
});
