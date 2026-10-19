// Invite links point at the website's home page with the table's id:
// https://playcapi.com/?join=<gameId> (the app shares this form; older web
// shares drop the slash). When one opens the app, through a universal link
// or capi://?join=<gameId>, it goes straight to that table, where a free
// seat shows the join card. Every other link passes through unchanged.
// Parsed by hand, so it does not depend on the runtime's URL support.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Scheme and host (optional), the home page path ("/" or nothing), and the
// query. Anything with a longer path is not an invite.
const HOME_WITH_QUERY = /^(?:[a-z][a-z0-9+.-]*:\/\/[^/?#]*)?\/?\?([^#]*)/i;

export function inviteRedirect(path: string): string {
  const match = HOME_WITH_QUERY.exec(path);
  if (!match) return path;
  for (const pair of match[1].split("&")) {
    const [key, value = ""] = pair.split("=");
    if (key !== "join") continue;
    const id = decodeURIComponent(value);
    return UUID.test(id) ? `/game/${id}` : path;
  }
  return path;
}
