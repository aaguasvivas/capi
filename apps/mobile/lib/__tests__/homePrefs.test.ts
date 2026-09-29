import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: store }));

import {
  loadHomePrefs,
  parseHomePrefs,
  saveHomePrefs,
  savedThemeAction,
} from "../homePrefs";

const RULES = {
  colors: ["#6366f1", "#10b981"],
  themes: ["barberia", "patio", "larimar"] as const,
  maxNickname: 20,
};

beforeEach(() => {
  store.getItem.mockReset();
  store.setItem.mockReset();
});

describe("parseHomePrefs", () => {
  it("restores every valid field", () => {
    const raw = JSON.stringify({
      nickname: "Auditora",
      avatarColor: "#10b981",
      theme: "patio",
      is2v2: true,
      targetScore: 200,
    });
    expect(parseHomePrefs(raw, RULES)).toEqual({
      nickname: "Auditora",
      avatarColor: "#10b981",
      theme: "patio",
      is2v2: true,
      targetScore: 200,
    });
  });

  it("drops unknown or malformed fields and keeps the rest", () => {
    const raw = JSON.stringify({
      nickname: "x".repeat(30),
      avatarColor: "#000000",
      theme: "casino",
      is2v2: "yes",
      targetScore: 150,
    });
    expect(parseHomePrefs(raw, RULES)).toEqual({ nickname: "x".repeat(20) });
  });

  it("starts from the defaults on missing or corrupt storage", () => {
    expect(parseHomePrefs(null, RULES)).toEqual({});
    expect(parseHomePrefs("{not json", RULES)).toEqual({});
    expect(parseHomePrefs("42", RULES)).toEqual({});
  });
});

describe("storage calls never throw", () => {
  it("reads through a storage failure as no prefs", async () => {
    store.getItem.mockRejectedValue(new Error("disk"));
    await expect(loadHomePrefs(RULES)).resolves.toEqual({});
  });

  it("drops a failed write", async () => {
    store.setItem.mockRejectedValue(new Error("disk"));
    expect(() =>
      saveHomePrefs({
        nickname: "Ana",
        avatarColor: "#6366f1",
        theme: "barberia",
        is2v2: false,
        targetScore: 100,
      })
    ).not.toThrow();
    await Promise.resolve();
    expect(store.setItem).toHaveBeenCalledTimes(1);
  });
});

describe("savedThemeAction", () => {
  const none = new Set<string>();
  const owns = new Set(["larimar"]);

  it("brings a free table back at once", () => {
    expect(savedThemeAction(undefined, none, false)).toBe("apply");
  });

  it("brings a premium table back only when owned", () => {
    expect(savedThemeAction("larimar", owns, false)).toBe("apply");
    expect(savedThemeAction("larimar", none, false)).toBe("wait");
    expect(savedThemeAction("larimar", none, true)).toBe("drop");
  });
});
