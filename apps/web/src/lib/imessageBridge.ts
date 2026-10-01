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
  // The state version this device sent a move from, until it sees the state
  // that move produced (see settleHandoff).
  pendingFrom?: number;
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

// The bubble a state calls for when this device's own move produced it: the
// next player's turn, or the result of the round or game the move ended
// (sent by the mover, whichever side won). A draw that keeps the turn here
// calls for none.
export function handoffEvent(gs: GameState, mySeat: Seat, gameId: string): BridgeEvent | null {
  const mine = getTeam(mySeat, gs.is2v2);
  const sides = bridgeSides(gs, mySeat);
  if (gs.phase === "playing") {
    if (gs.currentTurn === mySeat) return null;
    return { type: "moved", gameId, turnName: turnName(gs), ...sides };
  }
  if (gs.phase === "round_over") {
    return {
      type: "roundOver",
      gameId,
      iWon: gs.lastCalloutPayload?.winningTeam === mine,
      winnerName: roundWinnerName(gs),
      ...sides,
    };
  }
  if (gs.phase === "finished") {
    return { type: "gameOver", gameId, iWon: gs.winnerTeam === mine, ...gameWinner(gs), ...sides };
  }
  return null;
}

// Records that a move goes out from `version`. Kept in storage, so a drawer
// torn down before the answer still finds it when it opens again.
export function markPendingMove(gameId: string, version: number) {
  writeBridgeMarks(gameId, { ...readBridgeMarks(gameId), pendingFrom: version });
}

export function clearPendingMove(gameId: string) {
  const marks = readBridgeMarks(gameId);
  if (marks.pendingFrom === undefined) return;
  delete marks.pendingFrom;
  writeBridgeMarks(gameId, marks);
}

// Called with every confirmed state this device adopts, from any source: the
// move's own answer, realtime, a poll, or the first fetch after a reopen. The
// state one version after a pending move is that move's result (only the seat
// on turn can move; a claim against it is a forfeit, not its move), so its
// bubble goes out exactly once, even when the move's answer was lost. A later
// state means the moment passed; the mark is dropped without a bubble. The
// result of a round or game is posted here, at once, and marked so the result
// card does not send it again.
export function settleHandoff(gameId: string, gs: GameState | null, sv: number, mySeat: Seat | null) {
  const marks = readBridgeMarks(gameId);
  const from = marks.pendingFrom;
  if (from === undefined || sv <= from) return;
  delete marks.pendingFrom;
  const event = gs && mySeat && sv === from + 1 && !gs.forfeit ? handoffEvent(gs, mySeat, gameId) : null;
  if (event?.type === "roundOver") {
    marks.endedRound = gs!.roundIndex;
    marks.roundOver = gs!.roundIndex;
  } else if (event?.type === "gameOver") {
    marks.endedRound = gs!.roundIndex;
    marks.gameOver = true;
  }
  writeBridgeMarks(gameId, marks);
  if (event) postToExtension(event);
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
