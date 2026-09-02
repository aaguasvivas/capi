import { NextResponse, type NextRequest } from "next/server";

// Per-IP rate limit for the write endpoints. Runs on the edge, so the buckets
// are per isolate and reset when it recycles: a brake against scripts and
// stuck clients, not a hard quota. The game itself never comes close.
const WINDOW_MS = 60_000;
const LIMITS: Array<{ test: (path: string) => boolean; max: number }> = [
  { test: (p) => p === "/api/games" || p === "/api/bug-reports", max: 12 },
  { test: (p) => p.endsWith("/rematch") || p.endsWith("/join"), max: 20 },
  { test: () => true, max: 90 },
];

const buckets = new Map<string, number[]>();

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  const path = req.nextUrl.pathname;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rule = LIMITS.find((r) => r.test(path))!;
  if (limited(`${ip}:${rule.max}:${path.startsWith("/api/games/") ? "game" : path}`, rule.max)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
