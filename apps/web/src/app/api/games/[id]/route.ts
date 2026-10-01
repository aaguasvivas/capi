import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report";
import { gameLookupFailed, startIfFull } from "@/lib/gameDb";
import { maxPlayersFor, type GameRow, type PlayerRow } from "@/lib/gameStart";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = createServerClient();
    const { data: game, error } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !game) return gameLookupFailed(error, "GET /api/games/[id]");

    const { data: players, error: playersError } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);
    // An empty seat list would read as "nobody is seated here" and clients
    // would offer the join form instead of the player's own table.
    if (playersError) {
      reportError(playersError, "GET /api/games/[id] players");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // A full table still waiting lost its start write: deal it now. Every
    // lobby polls this route, so such a table starts within one poll.
    let row = game;
    if (game.status === "waiting") {
      const started = await startIfFull(db, game, (players ?? []) as PlayerRow[]);
      if (started) row = started as typeof game;
      else if ((players ?? []).length >= maxPlayersFor(game as GameRow)) {
        // A concurrent request may have started it: answer the fresh row.
        const { data: fresh } = await db.from("games").select("*").eq("id", params.id).single();
        if (fresh) row = fresh;
      }
    }

    return NextResponse.json({ game: row, players: players ?? [] });
  } catch (err) {
    reportError(err, "GET /api/games/[id]");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
