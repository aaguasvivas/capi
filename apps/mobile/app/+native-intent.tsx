import { inviteRedirect } from "../lib/inviteLink";

// Runs on every link that opens the app (universal links and capi://)
// before the router reads it.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return inviteRedirect(path);
}
