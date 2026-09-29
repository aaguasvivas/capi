import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMOTES, QUICK_PHRASES, chatText, chatWireText } from "@capi/i18n";
import { FakeDb, params, post, seedPlaying, type Seeded } from "./fakeDb";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => holder.db }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { POST } from "../games/[id]/chat/route";

let db: FakeDb;
let seeded: Seeded;

beforeEach(() => {
  db = new FakeDb();
  holder.db = db;
  seeded = seedPlaying(db);
});

async function chat(type: string, payload: string, playerId = seeded.players.n.id) {
  const id = seeded.game.id;
  const res = await POST(post(`/api/games/${id}/chat`, { playerId, type, payload }), params(id));
  return { status: res.status, body: await res.json() };
}

const stored = () => db.tables.chat_emotes.map((r) => r.payload);

describe("POST /api/games/[id]/chat", () => {
  it("accepts every phrase id and stores it as is", async () => {
    for (const p of QUICK_PHRASES) {
      expect((await chat("quick_chat", p.id)).status).toBe(200);
    }
    expect(stored()).toEqual(QUICK_PHRASES.map((p) => p.id));
  });

  it("accepts the display text in either language and stores the id", async () => {
    // What a sender broadcasts, and what the 1.0 app posts.
    expect((await chat("quick_chat", "¡Vamo' allá!")).status).toBe(200);
    expect((await chat("quick_chat", "We outside!")).status).toBe(200);
    expect(stored()).toEqual(["vamo_alla", "vamo_alla"]);
  });

  it("still maps the English text shipped clients send for a renamed phrase", async () => {
    // 1.0 and 1.1 know que_lo_que as "Say less!" and eso_e as "That's crazy!".
    expect((await chat("quick_chat", "Say less!")).status).toBe(200);
    expect((await chat("quick_chat", "What's up!")).status).toBe(200);
    expect((await chat("quick_chat", "That's crazy!")).status).toBe(200);
    expect(stored()).toEqual(["que_lo_que", "que_lo_que", "eso_e"]);
    // Both languages now say the same thing, and the wire keeps the text
    // shipped clients know.
    expect(chatText("quick_chat", "que_lo_que", "en")).toBe("What's up!");
    expect(chatText("quick_chat", "eso_e", "en")).toBe("That's it!");
    expect(chatWireText("quick_chat", "que_lo_que", "en")).toBe("Say less!");
    expect(chatWireText("quick_chat", "que_lo_que", "es")).toBe("¡Qué lo qué!");
    expect(chatWireText("quick_chat", "dale", "en")).toBe("Let's go!");
    expect(chatWireText("emote", "🔥", "en")).toBe("🔥");
  });

  it("accepts the listed emotes", async () => {
    for (const e of EMOTES) expect((await chat("emote", e)).status).toBe(200);
    expect(stored()).toEqual([...EMOTES]);
  });

  it("rejects free text, unknown emotes and unknown types without storing anything", async () => {
    expect(await chat("quick_chat", "nos vemos en el parque a las 5")).toMatchObject({
      status: 400,
      body: { error: "Invalid payload" },
    });
    expect((await chat("emote", "🍕")).status).toBe(400);
    expect((await chat("emote", "dale")).status).toBe(400);
    expect((await chat("text", "¡Dale!")).status).toBe(400);
    expect(stored()).toEqual([]);
  });

  it("refuses someone who is not at the table", async () => {
    const res = await chat("quick_chat", "dale", "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(403);
    expect(stored()).toEqual([]);
  });
});
