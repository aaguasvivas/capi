import type { GameState } from "@capi/engine";
import type { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report";

type Db = ReturnType<typeof createServerClient>;

// Sends the table's current row to everyone on its chat channel as a "state"
// message, the same message a mover sends after a move. A client that missed
// an update applies it: the 1.0 app takes any newer version, newer clients
// take the next version or refetch. Clients that are current drop it.
//
// The 1.0 app never polls and never refetches after its socket rejoins, so a
// missed event leaves both screens waiting on each other. Players who see that
// chat ("dale") or file a report, so those routes call this. It never fails
// the request that called it.
export async function rebroadcastState(db: Db, gameId: string): Promise<void> {
  try {
    const { data: game } = await db
      .from("games")
      .select("game_state, state_version")
      .eq("id", gameId)
      .maybeSingle();
    const gs = game?.game_state as GameState | null | undefined;
    if (!game || !gs) return;
    const channel = db.channel(`chat-${gameId}`);
    try {
      await channel.httpSend(
        "state",
        {
          gameState: gs,
          stateVersion: game.state_version as number,
          callout: gs.lastCallout ?? null,
          calloutPayload: gs.lastCalloutPayload ?? null,
        },
        { timeout: 2000 }
      );
    } finally {
      await db.removeChannel(channel);
    }
  } catch (err) {
    reportError(err, "rebroadcastState");
  }
}
