import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/engine/reducer";
import type { GameState, PlayerInfo, Seat } from "@/lib/engine/types";
import { getTeam } from "@/lib/engine/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { nickname, avatarColor = "#ec4899" } = body;

    if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
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

    if (game.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 409 });
    }

    const is2v2: boolean = game.settings?.is2v2 ?? false;
    const maxPlayers = is2v2 ? 4 : 2;

    const { data: existingPlayers } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);

    if (!existingPlayers || existingPlayers.length === 0) {
      return NextResponse.json({ error: "Game has no host" }, { status: 400 });
    }

    if (existingPlayers.length >= maxPlayers) {
      return NextResponse.json({ error: "Game is full" }, { status: 409 });
    }

    // Assign next seat deterministically: 1v1 → n,s; 2v2 → n,e,s,w
    const seatOrder: Seat[] = is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
    const takenSeats = new Set(existingPlayers.map((p) => p.seat));
    const nextSeat = seatOrder.find((s) => !takenSeats.has(s));
    if (!nextSeat) {
      return NextResponse.json({ error: "Game is full" }, { status: 409 });
    }

    const { data: newPlayer, error: playerError } = await db
      .from("players")
      .insert({
        game_id: params.id,
        seat: nextSeat,
        nickname: nickname.trim(),
        avatar_color: avatarColor,
      })
      .select()
      .single();

    if (playerError || !newPlayer) {
      console.error("Failed to create joining player:", playerError);
      return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
    }

    const allPlayers = [...existingPlayers, newPlayer];

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

    const initialState = createInitialState({
      mode: game.mode,
      theme: game.theme,
      is2v2,
    });

    const playersByState: Record<Seat, PlayerInfo | null> = { n: null, e: null, s: null, w: null };
    for (const p of allPlayers) {
      const seat = p.seat as Seat;
      playersByState[seat] = {
        seat,
        nickname: p.nickname,
        avatarColor: p.avatar_color,
        team: getTeam(seat, is2v2),
      };
    }

    const stateWithPlayers: GameState = {
      ...initialState,
      players: playersByState,
    };

    const { error: updateError } = await db
      .from("games")
      .update({
        status: "playing",
        game_state: stateWithPlayers,
        state_version: 1,
      })
      .eq("id", params.id)
      .eq("state_version", 0);

    if (updateError) {
      console.error("Failed to start game:", updateError);
      return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
    }

    return NextResponse.json({
      playerId: newPlayer.id,
      seat: nextSeat,
      gameId: params.id,
    });
  } catch (err) {
    console.error("POST /api/games/[id]/join error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
