import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

// Buckets live at module scope, so each test uses its own IP.
function hit(path: string, ip: string): number {
  const req = new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
  return middleware(req).status;
}

describe("rate limit", () => {
  it("keeps moves playable while quick chat is being mashed", () => {
    const ip = "10.0.0.1";
    let chatLimited = false;
    for (let i = 0; i < 120; i++) chatLimited ||= hit("/api/games/g1/chat", ip) === 429;
    expect(chatLimited).toBe(true);
    expect(hit("/api/games/g1/move", ip)).toBe(200);
  });

  it("still brakes a flood of moves from one address", () => {
    const ip = "10.0.0.2";
    const statuses = Array.from({ length: 91 }, () => hit("/api/games/g1/move", ip));
    expect(statuses.slice(0, 90).every((s) => s === 200)).toBe(true);
    expect(statuses[90]).toBe(429);
  });

  it("counts moves across every game from the same address", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 90; i++) hit(`/api/games/g${i}/move`, ip);
    expect(hit("/api/games/other/next-round", ip)).toBe(429);
  });
});
