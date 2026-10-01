import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Seat } from "@capi/engine";
import { maxPlayersFor, type GameRow, type PlayerRow } from "@/lib/gameStart";
import { cleanAvatarColor, cleanNickname } from "@/lib/validation";
import { reportError } from "@/lib/report";
import { gameLookupFailed, startIfFull } from "@/lib/gameDb";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const nickname = cleanNickname(body.nickname);
    const avatarColor = cleanAvatarColor(body.avatarColor, "#ec4899");

    if (!nickname) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: game, error: gameError } = await db
      .from("games")
      .select("*")
      .eq("id", params.id)
      .single();

    if (gameError || !game) return gameLookupFailed(gameError, "POST /api/games/[id]/join");

    // A retry after a lost answer: the join that filled the table dealt the
    // hand, but its device never got the seat. The joiner's own row is handed
    // back, found the way a rematch arrival finds its row (same name and
    // color, never the host's seat), for as long as that seat has never
    // played: the others may well have moved already. A newcomer can never
    // join a started table, so only the original joiner is asking.
    if (game.status === "playing" || game.status === "round_over") {
      const { data: seatedRows } = await db.from("players").select("*").eq("game_id", params.id);
      const own = ((seatedRows ?? []) as PlayerRow[]).find(
        (p) => p.seat !== "n" && p.nickname === nickname && p.avatar_color === avatarColor
      );
      if (own) {
        const { data: acted, error: actedError } = await db
          .from("moves")
          .select("id")
          .eq("game_id", params.id)
          .eq("player_id", own.id);
        if (!actedError && (acted ?? []).length === 0) {
          return NextResponse.json({ playerId: own.id, seat: own.seat, gameId: params.id });
        }
      }
    }

    if (game.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 409 });
    }

    const is2v2: boolean = game.settings?.is2v2 ?? false;
    const maxPlayers = maxPlayersFor(game as GameRow);

    const { data: existingPlayers, error: playersError } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);

    // A failed read is a server fault the client can retry, not a table
    // without a host (which clients show as "table not found").
    if (playersError) {
      reportError(playersError, "POST /api/games/[id]/join players");
      return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
    }
    if (!existingPlayers || existingPlayers.length === 0) {
      return NextResponse.json({ error: "Game has no host" }, { status: 400 });
    }

    if (existingPlayers.length >= maxPlayers) {
      // Full but still waiting: the join that filled it lost its start.
      await startIfFull(db, game as GameRow & { status: string }, existingPlayers as PlayerRow[]);
      return NextResponse.json({ error: "Game is full" }, { status: 409 });
    }

    // Assign the next free seat: 1v1 → n,s; 2v2 → n,e,s,w. The list above
    // can be stale when several people join at once, so a seat lost to the
    // unique (game_id, seat) index moves on to the next free one; the table
    // is full only when no seat is left.
    const seatOrder: Seat[] = is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
    const takenSeats = new Set(existingPlayers.map((p) => p.seat));
    let newPlayer: PlayerRow | null = null;
    let nextSeat: Seat | undefined;
    while (!newPlayer) {
      nextSeat = seatOrder.find((s) => !takenSeats.has(s));
      if (!nextSeat) {
        return NextResponse.json({ error: "Game is full" }, { status: 409 });
      }
      const { data: inserted, error: playerError } = await db
        .from("players")
        .insert({
          game_id: params.id,
          seat: nextSeat,
          nickname,
          avatar_color: avatarColor,
        })
        .select()
        .single();
      if (playerError?.code === "23505") {
        takenSeats.add(nextSeat);
        continue;
      }
      if (playerError) {
        // The insert may have committed with its answer lost: this request's
        // own row is then at the seat it asked for.
        const { data: landed } = await db
          .from("players")
          .select("*")
          .eq("game_id", params.id)
          .eq("seat", nextSeat)
          .maybeSingle();
        if (landed && landed.nickname === nickname && landed.avatar_color === avatarColor) {
          newPlayer = landed as PlayerRow;
          break;
        }
      }
      if (playerError || !inserted) {
        reportError(playerError, "POST /api/games/[id]/join insert");
        return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
      }
      newPlayer = inserted as PlayerRow;
    }

    // Count from a fresh read: with concurrent joins every request's first
    // list is short, and the one that fills the table must still start it.
    const { data: seated } = await db.from("players").select("*").eq("game_id", params.id);
    const allPlayers = (seated ?? [...existingPlayers, newPlayer]) as PlayerRow[];

    // Start the game only when all seats are filled
    if (allPlayers.length < maxPlayers) {
      return NextResponse.json({
        playerId: newPlayer.id,
        seat: nextSeat,
        gameId: params.id,
        waiting: true,
        playersJoined: allPlayers.length,
        playersNeeded: maxPlayers,
      });
    }

    // The seat is taken either way, so the answer always carries it. If this
    // start fails or a concurrent join dealt first, the client's first fetch
    // sees the live table: GET deals a full waiting table (startIfFull).
    await startIfFull(db, game as GameRow & { status: string }, allPlayers);

    return NextResponse.json({
      playerId: newPlayer.id,
      seat: nextSeat,
      gameId: params.id,
    });
  } catch (err) {
    reportError(err, "POST /api/games/[id]/join");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
