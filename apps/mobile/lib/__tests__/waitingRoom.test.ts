import { describe, expect, it } from "vitest";
import { refreshOutcome } from "../waitingRoom";

const host = { id: "p1", seat: "n" };
const guest = { id: "p2", seat: "s" };

describe("refreshOutcome", () => {
  it("reports a failed fetch", () => {
    expect(refreshOutcome(false, [host], [host])).toBe("networkError");
  });

  it("says nobody joined when every seat is the same", () => {
    expect(refreshOutcome(true, [host], [host])).toBe("refreshNoChange");
  });

  it("ignores the order the server lists players in", () => {
    expect(refreshOutcome(true, [host, guest], [guest, host])).toBe(
      "refreshNoChange"
    );
  });

  it("stays quiet when a player joined", () => {
    expect(refreshOutcome(true, [host], [host, guest])).toBeNull();
  });

  it("stays quiet when a player left or a seat changed hands", () => {
    expect(refreshOutcome(true, [host, guest], [host])).toBeNull();
    expect(
      refreshOutcome(true, [host, guest], [host, { id: "p3", seat: "s" }])
    ).toBeNull();
  });
});
