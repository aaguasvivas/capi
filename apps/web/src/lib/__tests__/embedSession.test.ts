import { describe, it, expect } from "vitest";
import { parseSessionFragment } from "../embedSession";

describe("parseSessionFragment", () => {
  it("parses #s=playerId.seat into a session for the game", () => {
    expect(parseSessionFragment("#s=abc-123.n", "game-9")).toEqual({
      playerId: "abc-123",
      seat: "n",
      gameId: "game-9",
    });
  });
  it("returns null for missing or malformed fragments", () => {
    expect(parseSessionFragment("", "g")).toBeNull();
    expect(parseSessionFragment("#other=1", "g")).toBeNull();
    expect(parseSessionFragment("#s=onlyid", "g")).toBeNull();
    expect(parseSessionFragment("#s=id.x", "g")).toBeNull(); // invalid seat
  });
  it("accepts all four seats", () => {
    for (const seat of ["n", "e", "s", "w"]) {
      expect(parseSessionFragment(`#s=p.${seat}`, "g")?.seat).toBe(seat);
    }
  });
});
