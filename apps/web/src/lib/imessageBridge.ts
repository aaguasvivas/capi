// Posts game milestones to the Capi iMessage extension so it can refresh the
// turn bubble. No-op everywhere else (window.webkit only exists in WKWebView
// with a registered handler).
export type BridgeEvent =
  | { type: "moved"; myScore: number; oppScore: number }
  | { type: "roundOver"; iWon: boolean; myScore: number; oppScore: number }
  | { type: "gameOver"; iWon: boolean; myScore: number; oppScore: number }
  // A rematch table replaced this one inside the drawer: the extension saves
  // the new session and points later bubbles at the new game.
  | { type: "rematch"; gameId: string; code: string; playerId: string; seat: string };

export function postToExtension(event: BridgeEvent): void {
  try {
    (window as any).webkit?.messageHandlers?.capi?.postMessage(event);
  } catch {
    /* not embedded */
  }
}
