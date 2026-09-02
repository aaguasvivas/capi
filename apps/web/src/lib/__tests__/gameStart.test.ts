import { describe, expect, it } from "vitest";
import { buildStartedState, maxPlayersFor } from "../gameStart";

const game = {
  id: "g1",
  mode: "live" as const,
  theme: "larimar" as const,
  settings: { targetScore: 200, is2v2: false },
};

const players = [
  { id: "p-n", seat: "n", nickname: "Ana", avatar_color: "#111111" },
  { id: "p-s", seat: "s", nickname: "Beto", avatar_color: "#222222" },
];

describe("maxPlayersFor", () => {
  it("is 2 for 1v1 and 4 for 2v2", () => {
    expect(maxPlayersFor(game)).toBe(2);
    expect(maxPlayersFor({ ...game, settings: { is2v2: true } })).toBe(4);
  });
});

describe("buildStartedState", () => {
  it("deals a playable first round with everyone seated in their seat", () => {
    const state = buildStartedState(game, players);
    expect(state.phase).toBe("playing");
    expect(state.theme).toBe("larimar");
    expect(state.targetScore).toBe(200);
    expect(state.players.n).toMatchObject({ nickname: "Ana", seat: "n", team: 0 });
    expect(state.players.s).toMatchObject({ nickname: "Beto", seat: "s", team: 1 });
    expect(state.players.e).toBeNull();
    // 28 tiles: 7 per seat minus the auto-played opener, rest in the boneyard.
    const dealt = state.hands.n.length + state.hands.s.length + state.board.length + state.boneyard.length;
    expect(dealt).toBe(28);
    expect(state.board.length).toBe(1);
  });

  it("ignores seats that do not exist in the mode", () => {
    const state = buildStartedState(game, [...players, { id: "x", seat: "e", nickname: "Ghost", avatar_color: "#333333" }]);
    expect(state.players.e).toBeNull();
    expect(state.hands.e).toEqual([]);
  });
});
