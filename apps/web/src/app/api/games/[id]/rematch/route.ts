import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSeatsForGame } from "@capi/engine";
import type { GameState } from "@capi/engine";
import { buildStartedState, maxPlayersFor, type GameRow, type PlayerRow } from "@/lib/gameStart";
import { uniqueInviteCode } from "@/lib/inviteCode";
import { reportError } from "@/lib/report";
import { gameLookupFailed } from "@/lib/gameDb";

type Db = ReturnType<typeof createServerClient>;

// A rematch seat row carries a copy of the original player's nickname and
// color (see arrive), and there is no other link between the two rows.
function sameSeatHolder(row: PlayerRow, who: PlayerRow): boolean {
  return row.nickname === who.nickname && row.avatar_color === who.avatar_color;
}

interface Arrival {
  gameId: string;
  inviteCode: string;
  playerId: string;
  seat: string;
  waiting: boolean;
}

// Seats `who` at the rematch table, in their original seat when it is free.
// Idempotent: a second call (or a second player's client racing the first)
// returns the existing row. Starts the table the moment the last seat fills.
// Returns "full" only when no seat is left for them.
async function arrive(db: Db, rematchId: string, who: PlayerRow): Promise<Arrival | "full" | null> {
  const { data: game } = await db.from("games").select("*").eq("id", rematchId).single();
  if (!game) return null;

  // Idempotent: this player already has a row at the table (a retry, or
  // their other device), wherever it is.
  const { data: tableRows } = await db.from("players").select("*").eq("game_id", rematchId);
  const rows = (tableRows ?? []) as PlayerRow[];
  let me: PlayerRow | null =
    rows.find((r) => r.seat === who.seat && sameSeatHolder(r, who)) ??
    rows.find((r) => sameSeatHolder(r, who)) ??
    null;

  if (!me) {
    // Their original seat first; if someone who took the invite code holds
    // it, the next free seat, so the table can still fill. Never hand out a
    // row that belongs to another person.
    const is2v2 = (game as GameRow).settings?.is2v2 ?? false;
    const order = [who.seat, ...getSeatsForGame(is2v2).filter((seat) => seat !== who.seat)];
    const taken = new Set(rows.map((r) => r.seat));
    for (const seat of order) {
      if (taken.has(seat)) continue;
      const { data: inserted, error } = await db
        .from("players")
        .insert({ game_id: rematchId, seat, nickname: who.nickname, avatar_color: who.avatar_color })
        .select()
        .single();
      if (!error && inserted) {
        me = inserted as PlayerRow;
        break;
      }
      if (error?.code !== "23505") return null;
      // Lost a race for this seat: it is this player's other request, or a
      // newcomer, and only the first counts as theirs.
      const { data: again } = await db
        .from("players")
        .select("*")
        .eq("game_id", rematchId)
        .eq("seat", seat)
        .single();
      if (again && sameSeatHolder(again as PlayerRow, who)) {
        me = again as PlayerRow;
        break;
      }
      taken.add(seat);
    }
    if (!me) return "full";
  }

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
    if (gameError || !game) return gameLookupFailed(gameError, "POST /api/games/[id]/rematch");

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
      if (arrival === "full") return NextResponse.json({ error: "Game is full" }, { status: 409 });
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
      reportError(newGameError, "POST /api/games/[id]/rematch create");
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }

    // lastCallout is cleared: every client (1.0 too) re-shows the callout of
    // any newer version, which would cover the game-over card with the final
    // callout again. The payload stays for the score summary.
    const { data: claimed } = await db
      .from("games")
      .update({
        game_state: { ...(state ?? {}), rematchGameId: newGame.id, lastCallout: null },
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
    if (arrival === "full") return NextResponse.json({ error: "Game is full" }, { status: 409 });
    if (!arrival) {
      return NextResponse.json({ error: "Failed to create rematch" }, { status: 500 });
    }
    return NextResponse.json(arrival);
  } catch (err) {
    reportError(err, "POST /api/games/[id]/rematch");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
