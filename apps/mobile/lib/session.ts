import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PlayerSession {
  playerId: string;
  seat: string;
  gameId: string;
}

const key = (gameId: string) => `capi_session_${gameId}`;

export async function getSession(gameId: string): Promise<PlayerSession | null> {
  try {
    const raw = await AsyncStorage.getItem(key(gameId));
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: PlayerSession): Promise<void> {
  try {
    await AsyncStorage.setItem(key(session.gameId), JSON.stringify(session));
  } catch {
    /* best effort */
  }
}

export async function clearSession(gameId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(gameId));
  } catch {
    /* best effort */
  }
}
