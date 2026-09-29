import type { GameState, Seat } from "@capi/engine";
import { getOpponentTeam, getTeam } from "@capi/engine";
import { isImessageEmbed } from "./embed";

// Posts game milestones to the Capi iMessage extension so it can refresh the
// turn bubble. Every event names the table it belongs to, and the scores and
// names are from the sender's side ("Ana 20 · Luis 35").
//
// Version skew: the 1.1 build 21 extension reads only type, myScore, oppScore
// and (on results) iWon, and sends a result only when iWon is true, under its
// own local name. The optional names, winnerIsTeam and the rematch `waiting`
// flag are for newer extensions, which fall back to that behavior when they
// are missing.
export interface BridgeSides {
  myScore: number;
  oppScore: number;
  myName?: string;
  oppName?: string;
}

export type BridgeEvent =
  // A confirmed action of this client left the turn on another seat.
  | ({ type: "moved"; gameId: string; turnName?: string } & BridgeSides)
  // This client's move ended the round (or the game), whichever side won.
  // winnerIsTeam: winnerName is a 2v2 side ("Ana & Rosa"), so the caption
  // takes the plural.
  | ({
      type: "roundOver" | "gameOver";
      gameId: string;
      iWon: boolean;
      winnerName?: string;
      winnerIsTeam?: boolean;
    } & BridgeSides)
  // A rematch table replaced this one inside the drawer: the extension saves
  // the new session and points later bubbles at the new game. waiting is the
  // rematch API's: true while other seats are still empty.
  | { type: "rematch"; gameId: string; code: string; playerId: string; seat: string; waiting: boolean };

// Only the drawer's own page talks to the extension: the same webview can
// end up on another page of the site, and that page must never post for the
// drawer's table.
export function postToExtension(event: BridgeEvent): void {
  try {
    if (!isImessageEmbed(new URLSearchParams(window.location.search))) return;
    (window as any).webkit?.messageHandlers?.capi?.postMessage(event);
  } catch {
    /* not embedded */
  }
}

const TEAM_SEATS: Record<"1v1" | "2v2", Record<0 | 1, Seat[]>> = {
  "1v1": { 0: ["n"], 1: ["s"] },
  "2v2": { 0: ["n", "s"], 1: ["e", "w"] },
};

function nickname(gs: GameState, seat: Seat | null | undefined): string | undefined {
  const name = seat ? gs.players?.[seat]?.nickname : undefined;
  return name && name.trim() ? name : undefined;
}

// A side as the table names it: "Ana", or "Ana & Luis" in 2v2.
function teamName(gs: GameState, team: 0 | 1): string | undefined {
  const names = TEAM_SEATS[gs.is2v2 ? "2v2" : "1v1"][team]
    .map((seat) => nickname(gs, seat))
    .filter((name): name is string => !!name);
  return names.length > 0 ? names.join(" & ") : undefined;
}

// Scores and side names from `mySeat`'s point of view.
export function bridgeSides(gs: GameState, mySeat: Seat): BridgeSides {
  const mine = getTeam(mySeat, gs.is2v2);
  const theirs = getOpponentTeam(mine);
  return {
    myScore: gs.scores[mine],
    oppScore: gs.scores[theirs],
    myName: teamName(gs, mine),
    oppName: teamName(gs, theirs),
  };
}

// The seat on turn, by name.
export function turnName(gs: GameState): string | undefined {
  return nickname(gs, gs.currentTurn);
}

// The player who won the round that just ended, as the engine picks who
// leads the next one: the player who went out, or the tranque's winner. A
// payload from before winnerSeat existed names the winning side's first
// player instead.
export function roundWinnerName(gs: GameState): string | undefined {
  const payload = gs.lastCalloutPayload;
  let seat: Seat | null | undefined;
  if (gs.lastCallout === "domino" || gs.lastCallout === "capicua") seat = gs.lastPlayedBy;
  else if (gs.lastCallout === "trancao") seat = payload?.winnerSeat;
  const team = payload?.winningTeam;
  if (seat && (team === undefined || getTeam(seat, gs.is2v2) === team)) return nickname(gs, seat);
  if (team === 0 || team === 1) {
    return TEAM_SEATS[gs.is2v2 ? "2v2" : "1v1"][team]
      .map((s) => nickname(gs, s))
      .find((name): name is string => !!name);
  }
  return undefined;
}

// The winner a game result names: in 2v2 the winning side ("Ana & Rosa"),
// in 1v1 the winner of the round that ended the game.
export function gameWinner(gs: GameState): { winnerName?: string; winnerIsTeam?: boolean } {
  const team = gs.winnerTeam;
  if (gs.is2v2 && (team === 0 || team === 1)) {
    const name = teamName(gs, team);
    if (name) return { winnerName: name, winnerIsTeam: true };
  }
  return { winnerName: roundWinnerName(gs) };
}

// iMessage bubble markers survive remounts: a finished game reopened later
// must not post its bubble again. A table finishes once, and each round ends
// once, so rounds are keyed by index. state_version is not stable enough for
// this: a rematch request bumps it on the finished game. endedRound is the
// round this device's own move ended, the one round whose result it sends.
export interface BridgeMarks {
  roundOver?: number;
  gameOver?: boolean;
  endedRound?: number;
}

export function readBridgeMarks(gameId: string): BridgeMarks {
  try {
    const raw = localStorage.getItem(`capi_bridge_${gameId}`);
    return raw ? (JSON.parse(raw) as BridgeMarks) : {};
  } catch {
    return {};
  }
}

export function writeBridgeMarks(gameId: string, marks: BridgeMarks) {
  try {
    localStorage.setItem(`capi_bridge_${gameId}`, JSON.stringify(marks));
  } catch {
    /* storage blocked: worst case is one repeated or one missing bubble */
  }
}

// What a result card does with the stored marks, as it shows:
// - "wait": this device has not marked the round as its own yet. The card
//   can show before the move response writes endedRound, so the card asks
//   again on the next state sync.
// - "skip": decided, no bubble. The result was already handled, or a rematch
//   invite already went out in the bubble session a late game result would
//   replace. The caller still stores the mark.
// - "post": send the result now and store the mark.
export function resultStep(
  type: "roundOver" | "gameOver",
  marks: BridgeMarks,
  gs: GameState
): "wait" | "skip" | "post" {
  const handled = type === "roundOver" ? marks.roundOver === gs.roundIndex : !!marks.gameOver;
  if (handled) return "skip";
  if (marks.endedRound !== gs.roundIndex) return "wait";
  if (type === "gameOver" && gs.rematchGameId) return "skip";
  return "post";
}
