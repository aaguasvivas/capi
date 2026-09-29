import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMOTES, QUICK_PHRASES, chatText, chatWireText, normalizeChatPayload } from "@capi/i18n";
import { FakeDb, get, legalIntent, params, post } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { POST as create } from "../games/route";
import { GET as byCode } from "../games/by-code/[code]/route";
import { POST as join } from "../games/[id]/join/route";
import { GET as getGame } from "../games/[id]/route";
import { POST as move } from "../games/[id]/move/route";
import { POST as nextRound } from "../games/[id]/next-round/route";
import { POST as rematch } from "../games/[id]/rematch/route";

// The 1.0 app (git 255a617) is live and cannot be updated. These are the
// response fields it reads, taken from 255a617 apps/mobile/app/index.tsx,
// apps/mobile/hooks/useRealtimeGame.ts and apps/mobile/app/game/[id].tsx.
// Adding fields is fine; removing, renaming or retyping one breaks 1.0.

// 255a617 packages/engine/src/types.ts GameState, which 1.0 renders from.
const STATE_FIELDS_10 = [
  "phase", "mode", "theme", "is2v2", "targetScore", "scores", "roundIndex", "hands", "board",
  "boneyard", "currentTurn", "consecutivePasses", "passesSinceLastPlay", "starterThisRound",
  "lastCallout", "lastCalloutPayload", "players", "winnerTeam", "lastPlayedBy",
];

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
});

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

// 1.0's create and join bodies, verbatim.
async function tableFor10() {
  const created = await json(
    await create(post("/api/games", {
      nickname: "Ana", avatarColor: "#6366f1", mode: "live", theme: "barberia", is2v2: false, targetScore: 100,
    }))
  );
  const code = db.row("games", created.body.gameId)!.invite_code as string;
  const lookup = await json(await byCode(get(`/api/games/by-code/${code}`), { params: { code } }));
  const joined = await json(
    await join(post(`/api/games/${lookup.body.gameId}/join`, { nickname: "Beto", avatarColor: "#ec4899" }), params(lookup.body.gameId))
  );
  return { created, lookup, joined, gameId: created.body.gameId as string };
}

describe("1.0 response contract", () => {
  it("POST /api/games returns gameId, playerId and seat", async () => {
    const { created } = await tableFor10();
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ gameId: expect.any(String), playerId: expect.any(String), seat: "n" });
  });

  it("GET /api/games/by-code/[code] returns gameId", async () => {
    const { lookup, gameId } = await tableFor10();
    expect(lookup).toEqual({ status: 200, body: { gameId } });
  });

  it("POST /join returns playerId and seat", async () => {
    const { joined } = await tableFor10();
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ playerId: expect.any(String), seat: "s" });
  });

  it("GET /api/games/[id] returns the game row and players 1.0 reads", async () => {
    const { gameId } = await tableFor10();
    const { status, body } = await json(await getGame(get(`/api/games/${gameId}`), params(gameId)));
    expect(status).toBe(200);
    expect(body.game).toMatchObject({
      state_version: expect.any(Number),
      invite_code: expect.any(String),
      settings: { is2v2: false, targetScore: 100 },
      game_state: expect.any(Object),
    });
    for (const field of STATE_FIELDS_10) expect(body.game.game_state).toHaveProperty(field);
    expect(body.players).toHaveLength(2);
    for (const p of body.players) {
      expect(p).toMatchObject({
        id: expect.any(String),
        seat: expect.any(String),
        nickname: expect.any(String),
        avatar_color: expect.any(String),
        game_id: gameId,
      });
    }
  });

  it("POST /move returns gameState, stateVersion, callout and calloutPayload, and stale on a version miss", async () => {
    const { gameId } = await tableFor10();
    const row = db.row("games", gameId)!;
    const seat = row.game_state.currentTurn as string;
    const player = db.tables.players.find((p) => p.game_id === gameId && p.seat === seat)!;
    const body = { playerId: player.id, seat, intent: legalIntent(row.game_state), stateVersion: row.state_version };

    const ok = await json(await move(post(`/api/games/${gameId}/move`, body), params(gameId)));
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("callout");
    expect(ok.body).toHaveProperty("calloutPayload");
    expect(ok.body.stateVersion).toBe(body.stateVersion + 1);
    for (const field of STATE_FIELDS_10) expect(ok.body.gameState).toHaveProperty(field);

    const stale = await json(await move(post(`/api/games/${gameId}/move`, body), params(gameId)));
    expect(stale.status).toBe(409);
    expect(stale.body.stale).toBe(true);
  });

  it("POST /next-round answers a version miss with 409 (1.0 refetches on any 409)", async () => {
    const { gameId, created } = await tableFor10();
    const row = db.row("games", gameId)!;
    row.status = "round_over";
    const res = await nextRound(
      post(`/api/games/${gameId}/next-round`, { playerId: created.body.playerId, stateVersion: row.state_version - 1 }),
      params(gameId)
    );
    expect(res.status).toBe(409);
  });

  it("POST /rematch returns gameId, playerId and seat", async () => {
    const { gameId, created } = await tableFor10();
    const row = db.row("games", gameId)!;
    row.status = "finished";
    row.game_state = { ...row.game_state, phase: "finished", winnerTeam: 0 };
    const res = await json(await rematch(post(`/api/games/${gameId}/rematch`, { playerId: created.body.playerId }), params(gameId)));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ gameId: expect.any(String), playerId: expect.any(String), seat: "n" });
  });
});

describe("chat wire contract", () => {
  // 1.0 prints a received chat payload verbatim, so senders broadcast the
  // display text (a renamed English phrase keeps its shipped text); newer
  // receivers map it back to the phrase id.
  for (const lang of ["es", "en"] as const) {
    it(`every phrase's ${lang} wire text is readable text that maps back to its id`, () => {
      for (const p of QUICK_PHRASES) {
        const wire = chatWireText("quick_chat", p.id, lang);
        expect(wire).toBe(lang === "en" ? (p.legacyEn ?? p.en) : p.es);
        expect(wire).not.toBe(p.id);
        expect(normalizeChatPayload("quick_chat", wire)).toBe(p.id);
      }
    });
  }

  it("emotes travel unchanged", () => {
    for (const e of EMOTES) {
      expect(chatText("emote", e, "es")).toBe(e);
      expect(normalizeChatPayload("emote", e)).toBe(e);
    }
  });

  it("every phrase a 1.0 sender posts still maps to an id (255a617 QuickChat.tsx)", () => {
    const legacy = [
      "¡Dale!", "¡Tranquilo!", "¡Aguanta!", "¡Eso e'!", "¡Vamo' allá!", "¡Qué lo qué!",
      "Let's go!", "Chill out!", "Hold up!", "That's crazy!", "We outside!", "Say less!",
    ];
    for (const text of legacy) expect(normalizeChatPayload("quick_chat", text)).not.toBeNull();
  });
});
