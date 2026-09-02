import { createInitialState, getSeatsForGame, getTeam } from "@capi/engine";
import type { GameState, PlayerInfo, Seat } from "@capi/engine";

export interface GameRow {
  id: string;
  mode: GameState["mode"];
  theme: GameState["theme"];
  settings: { targetScore?: number; is2v2?: boolean } | null;
}

export interface PlayerRow {
  id: string;
  seat: string;
  nickname: string;
  avatar_color: string;
}

export function maxPlayersFor(game: GameRow): number {
  return game.settings?.is2v2 ? 4 : 2;
}

// Deals the first round and seats everyone. Shared by the invite-code join
// and the rematch arrival so both tables start exactly the same way.
export function buildStartedState(game: GameRow, players: PlayerRow[]): GameState {
  const is2v2 = game.settings?.is2v2 ?? false;
  const initial = createInitialState({
    mode: game.mode,
    theme: game.theme,
    is2v2,
    targetScore: game.settings?.targetScore ?? 100,
  });
  const seated: Record<Seat, PlayerInfo | null> = { n: null, e: null, s: null, w: null };
  for (const p of players) {
    const seat = p.seat as Seat;
    if (!getSeatsForGame(is2v2).includes(seat)) continue;
    seated[seat] = {
      seat,
      nickname: p.nickname,
      avatarColor: p.avatar_color,
      team: getTeam(seat, is2v2),
    };
  }
  return { ...initial, players: seated };
}
