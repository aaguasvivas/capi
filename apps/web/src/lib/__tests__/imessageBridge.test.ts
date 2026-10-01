import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, Seat } from "@capi/engine";
import {
  bridgeSides,
  gameWinner,
  markPendingMove,
  postToExtension,
  readBridgeMarks,
  resultStep,
  roundWinnerName,
  settleHandoff,
  turnName,
} from "../imessageBridge";

const NAMES: Record<Seat, string> = { n: "Ana", e: "Luis", s: "Rosa", w: "Juan" };

function table(is2v2: boolean, patch: Partial<GameState> = {}): GameState {
  const seats: Seat[] = is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
  const players = { n: null, e: null, s: null, w: null } as GameState["players"];
  for (const seat of seats) {
    players[seat] = { seat, nickname: NAMES[seat], avatarColor: "#6366f1", team: 0 };
  }
  return {
    phase: "playing",
    mode: "turn_based",
    theme: "barberia",
    is2v2,
    targetScore: 100,
    scores: [20, 35],
    roundIndex: 2,
    hands: { n: [], e: [], s: [], w: [] },
    board: [],
    boneyard: [],
    currentTurn: "s",
    consecutivePasses: 0,
    passesSinceLastPlay: 0,
    starterThisRound: "n",
    lastCallout: null,
    lastCalloutPayload: null,
    players,
    winnerTeam: null,
    lastPlayedBy: "n",
    ...patch,
  };
}

describe("bridgeSides", () => {
  it("reads 1v1 scores and names from the sender's side", () => {
    expect(bridgeSides(table(false), "s")).toEqual({
      myScore: 35,
      oppScore: 20,
      myName: "Rosa",
      oppName: "Ana",
    });
  });

  it("names both partners of each 2v2 side", () => {
    expect(bridgeSides(table(true), "e")).toEqual({
      myScore: 35,
      oppScore: 20,
      myName: "Luis & Juan",
      oppName: "Ana & Rosa",
    });
  });

  it("leaves the names out when the table has none", () => {
    const gs = table(false, { players: { n: null, e: null, s: null, w: null } });
    expect(bridgeSides(gs, "n")).toEqual({ myScore: 20, oppScore: 35, myName: undefined, oppName: undefined });
  });
});

describe("turnName", () => {
  it("names the seat on turn", () => {
    expect(turnName(table(true, { currentTurn: "w" }))).toBe("Juan");
  });
});

describe("roundWinnerName", () => {
  const payload = { winningTeam: 0 as const, team0Pips: 0, team1Pips: 12 };

  it("names the player who went out on a dominó or capicúa", () => {
    expect(
      roundWinnerName(table(true, { lastCallout: "domino", lastPlayedBy: "s", lastCalloutPayload: payload }))
    ).toBe("Rosa");
    expect(
      roundWinnerName(table(false, { lastCallout: "capicua", lastPlayedBy: "n", lastCalloutPayload: payload }))
    ).toBe("Ana");
  });

  it("names the tranque winner, even when the blocker lost it", () => {
    const gs = table(true, {
      lastCallout: "trancao",
      lastPlayedBy: "e",
      lastCalloutPayload: { winningTeam: 0, team0Pips: 5, team1Pips: 9, blockerSeat: "e", rivalSeat: "s", winnerSeat: "s" },
    });
    expect(roundWinnerName(gs)).toBe("Rosa");
  });

  it("falls back to the winning side's first player without a winner seat", () => {
    const gs = table(true, {
      lastCallout: null,
      lastCalloutPayload: { winningTeam: 1, team0Pips: 9, team1Pips: 5 },
    });
    expect(roundWinnerName(gs)).toBe("Luis");
  });
});

describe("gameWinner", () => {
  const payload = { winningTeam: 0 as const, team0Pips: 0, team1Pips: 12 };

  it("names the winning 2v2 side, both partners, as a team", () => {
    const gs = table(true, {
      phase: "finished",
      winnerTeam: 0,
      lastCallout: "domino",
      lastPlayedBy: "s",
      lastCalloutPayload: payload,
    });
    expect(gameWinner(gs)).toEqual({ winnerName: "Ana & Rosa", winnerIsTeam: true });
    expect(gameWinner({ ...gs, winnerTeam: 1 })).toEqual({ winnerName: "Luis & Juan", winnerIsTeam: true });
  });

  it("names the 1v1 winner as before, with no team flag", () => {
    const gs = table(false, {
      phase: "finished",
      winnerTeam: 0,
      lastCallout: "domino",
      lastPlayedBy: "n",
      lastCalloutPayload: payload,
    });
    expect(gameWinner(gs)).toEqual({ winnerName: "Ana" });
  });
});

describe("resultStep", () => {
  const round = table(true, { phase: "round_over", roundIndex: 2 });
  const finished = table(true, { phase: "finished", roundIndex: 2, winnerTeam: 0 });

  it("waits while the move response has not marked the round as this device's", () => {
    expect(resultStep("roundOver", {}, round)).toBe("wait");
    expect(resultStep("roundOver", { endedRound: 1 }, round)).toBe("wait");
    expect(resultStep("gameOver", {}, finished)).toBe("wait");
  });

  it("posts once the move response marks the round, even after the card showed", () => {
    // The card showed first (wait), then the response wrote endedRound.
    expect(resultStep("roundOver", {}, round)).toBe("wait");
    expect(resultStep("roundOver", { endedRound: 2 }, round)).toBe("post");
    expect(resultStep("gameOver", {}, finished)).toBe("wait");
    expect(resultStep("gameOver", { endedRound: 2 }, finished)).toBe("post");
  });

  it("skips a result already handled", () => {
    expect(resultStep("roundOver", { endedRound: 2, roundOver: 2 }, round)).toBe("skip");
    expect(resultStep("roundOver", { roundOver: 2 }, round)).toBe("skip");
    expect(resultStep("gameOver", { endedRound: 2, gameOver: true }, finished)).toBe("skip");
    expect(resultStep("gameOver", { gameOver: true }, finished)).toBe("skip");
  });

  it("skips a game result that lands after the rematch invite went out", () => {
    const rematched = { ...finished, rematchGameId: "rematch-id" };
    expect(resultStep("gameOver", { endedRound: 2 }, rematched)).toBe("skip");
    // Not this device's round: still waits, and never posts.
    expect(resultStep("gameOver", {}, rematched)).toBe("wait");
  });
});

describe("postToExtension", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPage(search: string) {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      location: { search },
      webkit: { messageHandlers: { capi: { postMessage } } },
    });
    return postMessage;
  }

  it("posts from the drawer's embedded page", () => {
    const postMessage = stubPage("?embed=imessage&lang=es");
    postToExtension({ type: "moved", gameId: "g", myScore: 0, oppScore: 0 });
    expect(postMessage).toHaveBeenCalledWith({ type: "moved", gameId: "g", myScore: 0, oppScore: 0 });
  });

  it("stays silent on any other page in the same webview", () => {
    const postMessage = stubPage("");
    postToExtension({ type: "moved", gameId: "g", myScore: 0, oppScore: 0 });
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe("settleHandoff", () => {
  let store: Record<string, string>;
  let postMessage: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    store = {};
    postMessage = vi.fn();
    vi.stubGlobal("window", { location: { search: "?embed=imessage" }, webkit: { messageHandlers: { capi: { postMessage } } } });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Rosa (s) plays from version 7 in a 1v1 at round 2.
  const after = (patch: Partial<GameState>) => table(false, { currentTurn: "n", lastPlayedBy: "s", ...patch });

  it("posts the turn bubble when the state the move produced arrives, by any path, once", () => {
    markPendingMove("g", 7);
    settleHandoff("g", after({}), 7, "s");
    expect(postMessage).not.toHaveBeenCalled();
    settleHandoff("g", after({}), 8, "s");
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0]).toMatchObject({ type: "moved", gameId: "g", turnName: "Ana", myScore: 35, oppScore: 20 });
    // The move's own answer lands after realtime already brought it.
    settleHandoff("g", after({}), 8, "s");
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(readBridgeMarks("g").pendingFrom).toBeUndefined();
  });

  it("posts the round result at once and marks it, so the result card skips it", () => {
    markPendingMove("g", 7);
    const round = after({
      phase: "round_over",
      lastCallout: "domino",
      lastCalloutPayload: { winningTeam: 1, team0Pips: 12, team1Pips: 0, pipsAwarded: 12 },
    });
    settleHandoff("g", round, 8, "s");
    expect(postMessage.mock.calls[0][0]).toMatchObject({ type: "roundOver", iWon: true, winnerName: "Rosa" });
    const marks = readBridgeMarks("g");
    expect(marks).toMatchObject({ endedRound: 2, roundOver: 2 });
    expect(resultStep("roundOver", marks, round)).toBe("skip");
  });

  it("posts the game result for the move that ended the game", () => {
    markPendingMove("g", 7);
    const finished = after({ phase: "finished", winnerTeam: 1, lastCallout: "domino", lastCalloutPayload: { winningTeam: 1, team0Pips: 5, team1Pips: 0 } });
    settleHandoff("g", finished, 8, "s");
    expect(postMessage.mock.calls[0][0]).toMatchObject({ type: "gameOver", iWon: true });
    expect(readBridgeMarks("g")).toMatchObject({ gameOver: true, endedRound: 2 });
  });

  it("stays quiet for a draw that keeps the turn, a claim against the mover, or a state long past", () => {
    markPendingMove("g", 7);
    settleHandoff("g", after({ currentTurn: "s" }), 8, "s");
    markPendingMove("g", 8);
    settleHandoff("g", after({ phase: "finished", winnerTeam: 0, forfeit: { seat: "s", at: "x" } }), 9, "s");
    markPendingMove("g", 9);
    settleHandoff("g", after({}), 12, "s");
    expect(postMessage).not.toHaveBeenCalled();
    expect(readBridgeMarks("g").pendingFrom).toBeUndefined();
  });

  it("does nothing without a pending move", () => {
    settleHandoff("g", after({}), 8, "s");
    expect(postMessage).not.toHaveBeenCalled();
  });
});
