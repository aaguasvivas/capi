import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/reducer";
import type { GameState } from "../src/types";
import {
  CLAIM_AFTER_MS,
  CLAIM_ERRORS,
  canClaim,
  claimCheck,
  formatStall,
  stalledMs,
} from "../src/forfeit";

const T0 = Date.parse("2026-09-10T12:00:00.000Z");

function playing(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    mode: "live",
    theme: "barberia",
    is2v2: false,
    targetScore: 100,
    rng: () => 0.5,
  });
  return {
    ...base,
    phase: "playing",
    currentTurn: "s",
    lastMoveAt: new Date(T0).toISOString(),
    ...overrides,
  };
}

describe("stalledMs", () => {
  it("is null for a game without a clock", () => {
    expect(stalledMs(playing({ lastMoveAt: undefined }), T0)).toBeNull();
  });

  it("is null for a clock that does not parse", () => {
    expect(stalledMs(playing({ lastMoveAt: "yesterday" }), T0)).toBeNull();
  });

  it("never goes negative when the reader's clock is behind the state", () => {
    expect(stalledMs(playing(), T0 - 5_000)).toBe(0);
  });

  it("measures from the last move", () => {
    expect(stalledMs(playing(), T0 + 90_000)).toBe(90_000);
  });
});

describe("claimCheck", () => {
  it("refuses while the window is open and says how long is left", () => {
    const res = claimCheck(playing(), "n", T0 + 30_000);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(CLAIM_ERRORS.tooEarly);
    expect(res.status).toBe(409);
    expect(res.retryInMs).toBe(CLAIM_AFTER_MS - 30_000);
    expect(canClaim(playing(), "n", T0 + 30_000)).toBe(false);
  });

  it("refuses the side that is on turn", () => {
    const res = claimCheck(playing(), "s", T0 + CLAIM_AFTER_MS);
    expect(res).toMatchObject({ ok: false, error: CLAIM_ERRORS.ownSide, status: 403 });
  });

  it("refuses a game that is not in play", () => {
    const res = claimCheck(playing({ phase: "round_over" }), "n", T0 + CLAIM_AFTER_MS);
    expect(res).toMatchObject({ ok: false, error: CLAIM_ERRORS.notInPlay, status: 409 });
  });

  it("refuses a game that predates the clock", () => {
    const res = claimCheck(playing({ lastMoveAt: undefined }), "n", T0 + CLAIM_AFTER_MS);
    expect(res).toMatchObject({ ok: false, error: CLAIM_ERRORS.noClock, status: 409 });
  });

  it("ends the game for the claimer's side once the window closes", () => {
    const res = claimCheck(playing(), "n", T0 + CLAIM_AFTER_MS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.newState.phase).toBe("finished");
    expect(res.newState.winnerTeam).toBe(0);
    expect(res.newState.forfeit).toEqual({
      seat: "s",
      at: new Date(T0 + CLAIM_AFTER_MS).toISOString(),
    });
    expect(res.newState.lastCallout).toBeNull();
    // Hands and scores are untouched: the overlay still shows the standing.
    expect(res.newState.scores).toEqual([0, 0]);
    expect(res.newState.hands.s.length).toBeGreaterThan(0);
    expect(canClaim(playing(), "n", T0 + CLAIM_AFTER_MS)).toBe(true);
  });

  it("never lets anyone claim a turn-based game, however long the seat is silent", () => {
    const state = playing({ mode: "turn_based" });
    const res = claimCheck(state, "n", T0 + 24 * 60 * 60 * 1000);
    expect(res).toMatchObject({ ok: false, error: CLAIM_ERRORS.turnBased, status: 409 });
    expect(canClaim(state, "n", T0 + CLAIM_AFTER_MS)).toBe(false);
  });

  it("lets either partner of the other side claim in 2v2, never the silent side", () => {
    const base = createInitialState({
      mode: "live",
      theme: "barberia",
      is2v2: true,
      targetScore: 100,
      rng: () => 0.5,
    });
    const state: GameState = {
      ...base,
      phase: "playing",
      currentTurn: "e",
      lastMoveAt: new Date(T0).toISOString(),
    };
    const byNorth = claimCheck(state, "n", T0 + CLAIM_AFTER_MS);
    const bySouth = claimCheck(state, "s", T0 + CLAIM_AFTER_MS);
    const byPartner = claimCheck(state, "w", T0 + CLAIM_AFTER_MS);
    expect(byNorth.ok && byNorth.newState.winnerTeam).toBe(0);
    expect(bySouth.ok && bySouth.newState.winnerTeam).toBe(0);
    expect(byPartner).toMatchObject({ ok: false, error: CLAIM_ERRORS.ownSide });
  });
});

describe("formatStall", () => {
  it("renders minutes and zero-padded seconds", () => {
    expect(formatStall(0)).toBe("0:00");
    expect(formatStall(65_000)).toBe("1:05");
    expect(formatStall(600_999)).toBe("10:00");
  });
});
