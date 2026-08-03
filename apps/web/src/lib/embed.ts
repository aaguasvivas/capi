// True when the game page runs inside the Capi iMessage extension's webview.
// Gated by an explicit query param so normal navigation can never trigger it.
export function isImessageEmbed(searchParams: URLSearchParams | null): boolean {
  return searchParams?.get("embed") === "imessage";
}
