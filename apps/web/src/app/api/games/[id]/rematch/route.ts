import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { GameState } from "@capi/engine";
import { buildStartedState, maxPlayersFor, type GameRow, type PlayerRow } from "@/lib/gameStart";

type Db = ReturnType<typeof createServerClient>;

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function uniqueInviteCode(db: Db): Promise<string> {
  let code = generateInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data } = await db.from("games").select("id").eq("invite_code", code).single();
    if (!data) break;
    code = generateInviteCode();
  }
  return code;
}

interface Arrival {
  gameId: string;
  inviteCode: string;
  playerId: string;
  seat: string;
  waiting: boolean;
}

// Seats `who` at the rematch table in their original seat. Idempotent: a
// second call (or a second player's client racing the first) returns the
// existing seat. Starts the table the moment the last seat fills.
async function arrive(db: Db, rematchId: string, who: PlayerRow): Promise<Arrival | null> {
  const { data: game } = await db.from("games").select("*").eq("id", rematchId).single();
  if (!game) return null;

  const { data: existing } = await db
    .from("players")
    .select("*")
    .eq("game_id", rematchId)
    .eq("seat", who.seat)
    .maybeSingle();

  let me: PlayerRow | null = existing as PlayerRow | null;
  if (!me) {
    const { data: inserted, error } = await db
      .from("players")
      .insert({ game_id: rematchId, seat: who.seat, nickname: who.nickname, avatar_color: who.avatar_color })
      .select()
      .single();
    if (error?.code === "23505") {
      // Lost a race for the seat; the other request seated this player.
      const { data: again } = await db
        .from("players")
        .select("*")
        .eq("game_id", rematchId)
        .eq("seat", who.seat)
        .single();
      me = again as PlayerRow | null;
    } else {
      me = inserted as PlayerRow | null;
    }
  }
  if (!me) return null;

  const { data: players } = await db.from("players").select("*").eq("game_id", rematchId);
  const seated = (players ?? []) as PlayerRow[];
  let waiting = game.status === "waiting";

  if (waiting && seated.length >= maxPlayersFor(game as GameRow)) {
    const { error: startError } = await db
      .from("games")
      .update({ status: "playing", game_state: buildStartedState(game as GameRow, seated), state_version: 1 })
      .eq("id", rematchId)
      .eq("state_version", 0);
    // A concurrent arrival may have started it first; either way it is live.
    if (!startError) waiting = false;
    else {
      const { data: fresh } = await db.from("games").select("status").eq("id", rematchId).single();
      waiting = fresh?.status === "waiting";
    }
  }

  return { gameId: rematchId, inviteCode: game.invite_code, playerId: me.id, seat: me.seat, waiting };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playerId } = body as { playerId: string };
    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: game, error: gameError } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();
    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const { data: players } = await db.from("players").select("*").eq("game_id", params.id);
    const requester = (players ?? []).find((p) => p.id === playerId) as PlayerRow | undefined;
    if (!requester) {
      return NextResponse.json({ error: "Player not in this game" }, { status: 403 });
    }
    if (game.status !== "finished") {
      return NextResponse.json({ error: "Game is not finished" }, { status: 409 });
    }

    const state = game.game_state as GameState | null;

    // Someone already opened the rematch table: just take your seat there.
    if (state?.rematchGameId) {
      const arrival = await arrive(db, state.rematchGameId, requester);
      if (arrival) return NextResponse.json(arrival);
    }

    // First to ask: open the table with the same settings, then link it from
    // the finished game so every other seat's client can follow.
    const { data: newGame, error: newGameError } = await db
      .from("games")
      .insert({
        invite_code: await uniqueInviteCode(db),
        mode: game.mode,
        theme: game.theme,
        status: "waiting",
        state_version: 0,
        settings: { targetScore: game.settings?.targetScore ?? 100, is2v2: game.settings?.is2v2 ?? false },
      })
      .select()
      .single();
    if (newGameError || !newGame) {
      console.error("Failed to create rematch game:", newGameError);
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }

    const { data: claimed } = await db
      .from("games")
      .update({
        game_state: { ...(state ?? {}), rematchGameId: newGame.id },
        state_version: game.state_version + 1,
      })
      .eq("id", params.id)
      .eq("state_version", game.state_version)
      .select("id")
      .maybeSingle();

    let rematchId: string = newGame.id;
    if (!claimed) {
      // Another player opened a table first: drop ours and follow theirs.
      await db.from("games").delete().eq("id", newGame.id);
      const { data: fresh } = await db.from("games").select("game_state").eq("id", params.id).single();
      const linked = (fresh?.game_state as GameState | null)?.rematchGameId;
      if (!linked) {
        return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
      }
      rematchId = linked;
    }

    const arrival = await arrive(db, rematchId, requester);
    if (!arrival) {
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }
    return NextResponse.json(arrival);
  } catch (err) {
    console.error("POST /api/games/[id]/rematch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
