import { describe, expect, it } from "vitest";
import { applyMove, type CalloutPayload, type GameState, type Seat, type Tile } from "@capi/engine";
import { en, es } from "@capi/i18n";
import { tranqueLines, veinticincoLabel } from "../callouts";

const NAMES: Record<Seat, string> = { n: "Ana", e: "Luis", s: "Rosa", w: "Juan" };
const nameOf = (seat: Seat) => NAMES[seat];

// A 2v2 round North opened; the other fields are the engine's defaults.
function table(board: Tile[], hands: Record<Seat, Tile[]>, currentTurn: Seat): GameState {
  return {
    phase: "playing",
    mode: "live",
    theme: "barberia",
    is2v2: true,
    targetScore: 100,
    scores: [0, 0],
    roundIndex: 0,
    hands,
    board,
    boneyard: [],
    currentTurn,
    consecutivePasses: 0,
    passesSinceLastPlay: 0,
    starterThisRound: "n",
    lastCallout: null,
    lastCalloutPayload: null,
    players: { n: null, e: null, s: null, w: null },
    winnerTeam: null,
    lastPlayedBy: "n",
  };
}

function play(state: GameState, seat: Seat, tile: Tile): GameState {
  const r = applyMove(state, seat, { type: "play", tile, end: "right" });
  expect(r.error).toBeUndefined();
  return r.newState;
}

function pass(state: GameState, seat: Seat): GameState {
  const r = applyMove(state, seat, { type: "pass" });
  expect(r.error).toBeUndefined();
  return r.newState;
}

describe("veinticincoLabel", () => {
  it("names a pase de salida in both languages", () => {
    const p: CalloutPayload = {
      winningTeam: 0,
      veinticincoBonus: 25,
      salida: true,
      team0Pips: 40,
      team1Pips: 50,
    };
    expect(veinticincoLabel(p, es)).toBe("¡PASE DE SALIDA!");
    expect(veinticincoLabel(p, en)).toBe("¡PASE DE SALIDA!");
  });

  it("keeps ¡VEINTICINCO! for a pase corrido and a missing payload", () => {
    const p: CalloutPayload = { winningTeam: 1, veinticincoBonus: 25, team0Pips: 40, team1Pips: 50 };
    expect(veinticincoLabel(p, en)).toBe("¡VEINTICINCO!");
    expect(veinticincoLabel(null, es)).toBe("¡VEINTICINCO!");
  });

  it("reads the engine's pase de salida: East passes on the 6-6, South plays", () => {
    const start = table(
      [[6, 6]],
      {
        n: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
        e: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 2], [2, 3]],
        s: [[5, 6], [2, 4], [2, 5], [3, 3], [3, 4], [3, 5], [4, 4]],
        w: [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [4, 5], [5, 5]],
      },
      "e"
    );
    const after = play(pass(start, "e"), "s", [5, 6]);
    expect(after.lastCallout).toBe("veinticinco");
    expect(after.lastCalloutPayload?.winningTeam).toBe(0);
    expect(veinticincoLabel(after.lastCalloutPayload, es)).toBe(es.calloutSalida);
  });

  it("reads an all-pass opening as a pase corrido, not a salida", () => {
    const start = table(
      [[6, 6]],
      {
        n: [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]],
        e: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 1]],
        s: [[1, 2], [1, 3], [1, 4], [1, 5], [2, 2], [2, 3], [2, 4]],
        w: [[2, 5], [3, 3], [3, 4], [3, 5], [4, 4], [4, 5], [5, 5]],
      },
      "e"
    );
    const cancelled = pass(pass(start, "e"), "s");
    expect(cancelled.lastCallout).toBeNull();
    const corrido = pass(cancelled, "w");
    expect(corrido.lastCallout).toBe("veinticinco");
    expect(corrido.scores).toEqual([25, 0]);
    expect(veinticincoLabel(corrido.lastCalloutPayload, en)).toBe("¡VEINTICINCO!");
  });
});

describe("tranqueLines", () => {
  const base = { winningTeam: 0 as const, team0Pips: 30, team1Pips: 20, pts: 50 };

  it("shows only the comparison when the pips differ", () => {
    const p: CalloutPayload = { ...base, blockerSeat: "s", rivalSeat: "w", blockerPips: 9, rivalPips: 12, winnerSeat: "s" };
    expect(tranqueLines(p, nameOf, en)).toEqual(["Tranque: Rosa 9 · Juan 12"]);
  });

  it("names the payload's winner on a tie", () => {
    const p: CalloutPayload = { ...base, blockerSeat: "s", rivalSeat: "w", blockerPips: 12, rivalPips: 12, winnerSeat: "n" };
    expect(tranqueLines(p, nameOf, es)).toEqual([
      "Tranque: Rosa 12 · Juan 12",
      "Empate: gana Ana, que salió",
    ]);
    expect(tranqueLines(p, nameOf, en)[1]).toBe("Tie goes to Ana, who opened");
  });

  it("shows no tie line when a tied payload has no winnerSeat", () => {
    // Saved by the previous engine: that tie went to South, not the opener.
    const p: CalloutPayload = { ...base, blockerSeat: "e", rivalSeat: "s", blockerPips: 7, rivalPips: 7 };
    expect(tranqueLines(p, nameOf, en)).toEqual(["Tranque: Luis 7 · Rosa 7"]);
  });

  it("has no lines for tranques from before the comparison fields", () => {
    expect(tranqueLines({ ...base }, nameOf, en)).toEqual([]);
    expect(tranqueLines(null, nameOf, en)).toEqual([]);
  });

  it("reads the engine's tie: South locks, ties West, and North (the opener) wins", () => {
    // Ends 0 and 6 with every other 0 on the board; South's 0-6 locks it.
    const start = table(
      [[0, 1], [1, 2], [2, 0], [0, 0], [0, 3], [3, 4], [4, 0], [0, 5], [5, 6]],
      {
        n: [[1, 4], [1, 5], [1, 6], [2, 3], [2, 5], [2, 6], [3, 3]],
        e: [[3, 5], [3, 6], [4, 4], [4, 5], [4, 6], [5, 5], [6, 6]],
        s: [[0, 6], [1, 3], [2, 2]],
        w: [[1, 1], [2, 4]],
      },
      "s"
    );
    const after = play(start, "s", [0, 6]);
    expect(after.lastCallout).toBe("trancao");
    expect(after.lastCalloutPayload?.winnerSeat).toBe("n");
    expect(tranqueLines(after.lastCalloutPayload, nameOf, en)).toEqual([
      "Tranque: Rosa 8 · Juan 8",
      "Tie goes to Ana, who opened",
    ]);
  });
});
