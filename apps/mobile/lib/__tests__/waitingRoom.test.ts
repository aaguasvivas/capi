import { describe, expect, it } from "vitest";
import { refreshOutcome } from "../waitingRoom";

const host = { id: "p1", seat: "n" };
const guest = { id: "p2", seat: "s" };

describe("refreshOutcome", () => {
  it("reports a failed fetch", () => {
    expect(refreshOutcome(false, [host], [host], 1)).toBe("networkError");
  });

  it("says no one new joined when every seat is the same", () => {
    expect(refreshOutcome(true, [host], [host], 1)).toBe("refreshNoChange");
  });

  it("ignores the order the server lists players in", () => {
    expect(refreshOutcome(true, [host, guest], [guest, host], 2)).toBe(
      "refreshNoChange"
    );
  });

  it("stays quiet when a player joined", () => {
    expect(refreshOutcome(true, [host], [host, guest], 0)).toBeNull();
  });

  it("stays quiet when a player left or a seat changed hands", () => {
    expect(refreshOutcome(true, [host, guest], [host], 1)).toBeNull();
    expect(
      refreshOutcome(true, [host, guest], [host, { id: "p3", seat: "s" }], 0)
    ).toBeNull();
  });

  it("stays quiet on a full table waiting for its deal", () => {
    expect(refreshOutcome(true, [host, guest], [host, guest], 0)).toBeNull();
  });

  it("still reports a failed fetch on a full table", () => {
    expect(refreshOutcome(false, [host, guest], [host, guest], 0)).toBe(
      "networkError"
    );
  });
});
