import { afterEach, describe, expect, it, vi } from "vitest";
import { readProfile, saveProfile } from "../profile";

const PALETTE = ["#6366f1", "#ec4899"];

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("profile", () => {
  it("round-trips the name and color", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveProfile({ nickname: "Ana", avatarColor: "#ec4899" });
    expect(readProfile(PALETTE)).toEqual({ nickname: "Ana", avatarColor: "#ec4899" });
  });

  it("drops a color outside the form's palette and a name that does not fit", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    localStorage.setItem("capi_profile", JSON.stringify({ nickname: "x".repeat(21), avatarColor: "#123456" }));
    expect(readProfile(PALETTE)).toEqual({});
  });

  it("returns nothing when storage is missing, blocked or corrupt", () => {
    expect(readProfile(PALETTE)).toEqual({});
    expect(() => saveProfile({ nickname: "Ana", avatarColor: "#6366f1" })).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readProfile(PALETTE)).toEqual({});
    expect(() => saveProfile({ nickname: "Ana", avatarColor: "#6366f1" })).not.toThrow();
    vi.stubGlobal("localStorage", memoryStorage());
    localStorage.setItem("capi_profile", "{not json");
    expect(readProfile(PALETTE)).toEqual({});
  });
});
