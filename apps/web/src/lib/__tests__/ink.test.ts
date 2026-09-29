import { describe, expect, it } from "vitest";
import { contrastRatio, inkOn } from "../ink";

// Every avatar color the web and the Messages extension hand out.
const AVATARS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

describe("inkOn", () => {
  it("gives every avatar color a chat label of at least 4.5:1", () => {
    for (const fill of AVATARS) {
      expect(contrastRatio(inkOn(fill), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps white on dark fills and black on light ones", () => {
    expect(inkOn("#1d1d3a")).toBe("#ffffff");
    expect(inkOn("#f59e0b")).toBe("#000000");
  });

  it("matches the WCAG reference ratio", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#6366f1")).toBeCloseTo(4.47, 2);
  });
});
