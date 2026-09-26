import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIM_AFTER_MS, getTeam } from "@capi/engine";
import { errorKeyFor } from "@capi/i18n";
import { FakeDb, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report";
import { POST } from "../games/[id]/claim/route";

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
  vi.mocked(reportError).mockClear();
});

// A table whose seat on turn has been silent for `silentMs`.
function stalled(silentMs: number, mode: "live" | "turn_based" = "live"): Seeded {
  const seeded = seedPlaying(db, { mode, version: 3 });
  const row = db.row("games", seeded.game.id)!;
  row.game_state.lastMoveAt = new Date(Date.now() - silentMs).toISOString();
  return seeded;
}

// The seat that may claim: the one not on turn (1v1).
function claimer(seeded: Seeded) {
  return seeded.state.currentTurn === "n" ? seeded.players.s : seeded.players.n;
}

async function claim(seeded: Seeded, playerId: string) {
  const res = await POST(post(`/api/games/${seeded.game.id}/claim`, { playerId }), params(seeded.game.id));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/games/[id]/claim", () => {
  it("refuses a turn-based game however long the seat is silent", async () => {
    const seeded = stalled(24 * 60 * 60 * 1000, "turn_based");
    const res = await claim(seeded, claimer(seeded).id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Claim is not available in turn-based games");
    expect(errorKeyFor(res.body.error)).toBe("errClaimTurnBased");
    expect(db.row("games", seeded.game.id)?.status).toBe("playing");
  });

  it("refuses too early and says how long is left", async () => {
    const seeded = stalled(30_000);
    const res = await claim(seeded, claimer(seeded).id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Too early to claim");
    expect(res.body.retryInMs).toBeGreaterThan(CLAIM_AFTER_MS - 31_000);
    expect(res.body.retryInMs).toBeLessThanOrEqual(CLAIM_AFTER_MS - 30_000);
  });

  it("refuses the side on turn", async () => {
    const seeded = stalled(CLAIM_AFTER_MS + 1_000);
    const res = await claim(seeded, seeded.players[seeded.state.currentTurn].id);
    expect(res.status).toBe(403);
    expect(errorKeyFor(res.body.error)).toBe("errClaimOwnSide");
  });

  it("refuses someone who is not at the table", async () => {
    const seeded = stalled(CLAIM_AFTER_MS + 1_000);
    const res = await claim(seeded, "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(403);
  });

  it("ends the game for the claimer's side once the window closes", async () => {
    const seeded = stalled(CLAIM_AFTER_MS + 1_000);
    const me = claimer(seeded);
    const res = await claim(seeded, me.id);
    expect(res.status).toBe(200);
    expect(res.body.stateVersion).toBe(4);
    expect(res.body.gameState.phase).toBe("finished");
    expect(res.body.gameState.winnerTeam).toBe(getTeam(me.seat, false));
    expect(res.body.gameState.forfeit.seat).toBe(seeded.state.currentTurn);
    const row = db.row("games", seeded.game.id)!;
    expect(row).toMatchObject({ status: "finished", state_version: 4 });
  });

  it("answers stale when a move landed in between", async () => {
    const seeded = stalled(CLAIM_AFTER_MS + 1_000);
    db.intercept = (call) => {
      if (call.table !== "games" || call.op !== "update") return undefined;
      db.row("games", seeded.game.id)!.state_version = 4;
      return { data: null, error: null };
    };
    const res = await claim(seeded, claimer(seeded).id);
    expect(res.status).toBe(409);
    expect(res.body.stale).toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a refused write as a server error, not as stale", async () => {
    const seeded = stalled(CLAIM_AFTER_MS + 1_000);
    db.lockWrites = true;
    const res = await claim(seeded, claimer(seeded).id);
    expect(res.status).toBe(500);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
