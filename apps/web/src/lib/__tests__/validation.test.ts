import { describe, expect, it } from "vitest";
import { NICKNAME_MAX, cleanNickname } from "../validation";

describe("cleanNickname", () => {
  it("collapses spaces and trims", () => {
    expect(cleanNickname("  Juan   Carlos ")).toBe("Juan Carlos");
  });

  it("cuts at the 20-unit limit", () => {
    expect(cleanNickname("a".repeat(30))).toBe("a".repeat(NICKNAME_MAX));
  });

  it("never splits an emoji at the cut", () => {
    const name = cleanNickname("Juan Carlos Rodrigu\u{1F600}");
    expect(name).toBe("Juan Carlos Rodrigu");
    expect(/[\uD800-\uDFFF]/.test(name!)).toBe(false);
  });

  it("keeps an emoji that fits", () => {
    expect(cleanNickname("Juan Carlos Rodri\u{1F600}")).toBe("Juan Carlos Rodri\u{1F600}");
  });

  it("rejects a blank name", () => {
    expect(cleanNickname("   ")).toBeNull();
  });
});
