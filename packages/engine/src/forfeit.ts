import type { GameState, Seat } from "./types";
import { getTeam } from "./types";

// A table cannot wait forever for a seat that stopped playing. Once the seat
// on turn has been silent this long (measured from the server clock the API
// stores in `lastMoveAt`), any player on the other side may claim the game.
// Turn-based games (the iMessage extension creates them) are played over
// hours, so silence there is normal and they can never be claimed.
export const CLAIM_AFTER_MS = 120_000;

// The table starts saying how long the seat has been silent from here on.
export const STALL_NOTICE_MS = 60_000;

// Fixed messages, mapped to translated copy by packages/i18n errorKeyFor.
export const CLAIM_ERRORS = {
  notInPlay: "Game is not in play",
  ownSide: "Your side is on turn",
  noClock: "No move on record yet",
  tooEarly: "Too early to claim",
  turnBased: "Claim is not available in turn-based games",
} as const;

export type ClaimCheck =
  | { ok: true; newState: GameState }
  | { ok: false; error: string; status: number; retryInMs?: number };

// Milliseconds since the last accepted move, or null when this game predates
// the clock (nothing to claim until someone moves).
export function stalledMs(state: GameState, now: number): number | null {
  if (!state.lastMoveAt) return null;
  const at = Date.parse(state.lastMoveAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, now - at);
}

// True when this seat may claim the game right now, given the same clock the
// server will use. Clients use it to decide whether to show the button.
export function canClaim(state: GameState, seat: Seat, now: number): boolean {
  return claimCheck(state, seat, now).ok;
}

export function claimCheck(state: GameState, claimer: Seat, now: number): ClaimCheck {
  if (state.mode === "turn_based") {
    return { ok: false, error: CLAIM_ERRORS.turnBased, status: 409 };
  }
  if (state.phase !== "playing") {
    return { ok: false, error: CLAIM_ERRORS.notInPlay, status: 409 };
  }
  const silentSeat = state.currentTurn;
  const silentTeam = getTeam(silentSeat, state.is2v2);
  const claimerTeam = getTeam(claimer, state.is2v2);
  if (claimerTeam === silentTeam) {
    return { ok: false, error: CLAIM_ERRORS.ownSide, status: 403 };
  }
  const stalled = stalledMs(state, now);
  if (stalled === null) {
    return { ok: false, error: CLAIM_ERRORS.noClock, status: 409 };
  }
  if (stalled < CLAIM_AFTER_MS) {
    return {
      ok: false,
      error: CLAIM_ERRORS.tooEarly,
      status: 409,
      retryInMs: CLAIM_AFTER_MS - stalled,
    };
  }
  return {
    ok: true,
    newState: {
      ...state,
      phase: "finished",
      winnerTeam: claimerTeam,
      lastCallout: null,
      lastCalloutPayload: null,
      forfeit: { seat: silentSeat, at: new Date(now).toISOString() },
    },
  };
}

// "m:ss" for the stall notice.
export function formatStall(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
