import { describe, expect, it } from "vitest";
import { seatBackSkin } from "../tileBacks";

describe("seatBackSkin", () => {
  it("draws a seat with a premium design in that design, whatever the viewer uses", () => {
    expect(seatBackSkin("kingston", "clasico")).toBe("kingston");
    expect(seatBackSkin("borinquen", "quisqueya")).toBe("borinquen");
  });

  it("draws a seat without one in the viewer's design", () => {
    for (const value of [null, undefined, "clasico", "oro", 5]) {
      expect(seatBackSkin(value, "quisqueya")).toBe("quisqueya");
      expect(seatBackSkin(value, "clasico")).toBe("clasico");
    }
  });
});
