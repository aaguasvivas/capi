// True when the game page runs inside the Capi iMessage extension's webview.
// Gated by an explicit query param so normal navigation can never trigger it.
export function isImessageEmbed(searchParams: URLSearchParams | null): boolean {
  return searchParams?.get("embed") === "imessage";
}

// The extension passes the device language; the embedded table adopts it so
// native chrome and web content agree.
export function embedLang(searchParams: URLSearchParams | null): "es" | "en" | null {
  const l = searchParams?.get("lang");
  return l === "es" || l === "en" ? l : null;
}
