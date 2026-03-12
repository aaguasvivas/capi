import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/engine/reducer";
import type { GameState, PlayerInfo } from "@/lib/engine/types";

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

    // Load the game
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

    // Load existing players
    const { data: existingPlayers } = await db
      .from("players")
      .select("*")
      .eq("game_id", params.id);

    if (!existingPlayers || existingPlayers.length === 0) {
      return NextResponse.json({ error: "Game has no host" }, { status: 400 });
    }

    if (existingPlayers.length >= 2) {
      return NextResponse.json({ error: "Game is full" }, { status: 409 });
    }

    // Creator is seat "n", joiner gets seat "s"
    const { data: newPlayer, error: playerError } = await db
      .from("players")
      .insert({
        game_id: params.id,
        seat: "s",
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

    // Build the initial game state now that we have 2 players
    const initialState = createInitialState({
      mode: game.mode,
      theme: game.theme,
      is2v2: game.settings?.is2v2 ?? false,
    });

    // Embed player info into the game state
    const hostPlayer = allPlayers.find((p) => p.seat === "n")!;
    const joinPlayer = newPlayer;

    const stateWithPlayers: GameState = {
      ...initialState,
      players: {
        n: {
          seat: "n",
          nickname: hostPlayer.nickname,
          avatarColor: hostPlayer.avatar_color,
          team: 0,
        } as PlayerInfo,
        s: {
          seat: "s",
          nickname: joinPlayer.nickname,
          avatarColor: joinPlayer.avatar_color,
          team: 1,
        } as PlayerInfo,
        e: null,
        w: null,
      },
    };

    // Update game to playing status with initial state
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
      seat: "s",
      gameId: params.id,
    });
  } catch (err) {
    console.error("POST /api/games/[id]/join error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
