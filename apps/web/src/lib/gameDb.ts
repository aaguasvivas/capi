import { NextResponse } from "next/server";
import type { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report";
import { rebroadcastState } from "@/lib/resync";
import { buildStartedState, maxPlayersFor, type GameRow, type PlayerRow } from "@/lib/gameStart";

type Db = ReturnType<typeof createServerClient>;
type DbError = { code?: string } | null | undefined;

// Deals a waiting table whose every seat is taken. The join or rematch
// arrival that filled it can lose its start write or its answer, and no
// other route would ever start it, so the GET that every lobby polls and
// the join that finds the table full call this too. Resolves to the started
// row, or null when the table is not full, not waiting, or a concurrent
// request started it first.
export async function startIfFull(
  db: Db,
  game: GameRow & { status: string },
  players: PlayerRow[]
): Promise<Record<string, unknown> | null> {
  if (game.status !== "waiting" || players.length < maxPlayersFor(game)) return null;
  const { data: started, error } = await db
    .from("games")
    .update({
      status: "playing",
      game_state: buildStartedState(game, players),
      state_version: 1,
    })
    .eq("id", game.id)
    .eq("state_version", 0)
    .select()
    .maybeSingle();
  if (error) {
    reportError(error, "startIfFull");
    return null;
  }
  return started ?? null;
}

// The table's status column for a game state, so every writer derives it the
// same way and the column can never disagree with the phase.
export function statusFor(phase: string): "playing" | "round_over" | "finished" {
  return phase === "finished" ? "finished" : phase === "round_over" ? "round_over" : "playing";
}

// supabase-js returns database failures instead of throwing them, so every
// route has to tell "no such row" apart from "the database failed". PostgREST
// answers .single() with PGRST116 when no row matches, and a malformed uuid
// with 22P02; both mean the game does not exist.
export function isMissingRow(error: DbError): boolean {
  return !error || error.code === "PGRST116" || error.code === "22P02";
}

// The answer for a game lookup that came back empty. Clients delete the saved
// seat on 404, so an outage must never look like a missing game.
export function gameLookupFailed(error: DbError, where: string): NextResponse {
  if (isMissingRow(error)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  reportError(error, where);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// The answer for a conditional update (.eq("state_version", v)) that wrote no
// row. If the version moved on, another request won the race and the client
// only has to refetch. If it did not, nothing raced: the database refused the
// write (for example writes locked by migration 005 without the service key),
// and answering "stale" would send every client into a silent refetch loop.
export async function unwrittenUpdate(
  db: Db,
  gameId: string,
  expectedVersion: number,
  where: string,
  updateError?: DbError
): Promise<NextResponse> {
  const { data: fresh } = await db
    .from("games")
    .select("state_version")
    .eq("id", gameId)
    .maybeSingle();
  if (fresh && fresh.state_version !== expectedVersion) {
    // When the write did commit and only its answer was lost, the mover
    // never broadcasts the new state, so push it here. A race loser's peers
    // already hold this version and drop the message.
    await rebroadcastState(db, gameId);
    return NextResponse.json({ error: "State conflict - refetch", stale: true }, { status: 409 });
  }
  reportError(
    updateError && updateError.code !== "PGRST116"
      ? updateError
      : new Error(`update wrote no row at unchanged state_version ${expectedVersion}`),
    where
  );
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
