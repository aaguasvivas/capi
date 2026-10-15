// Content of capi-shared.json, the file the app writes to the App Group for
// the iMessage extension: the picked design when it is premium and owned,
// and the owned premium tables, sorted. Pure module so it unit-tests without
// React Native; lib/sharedFile.ts writes it.
import type { Entitlements } from "./iapCatalog";
import { skinToSend } from "./seatSkins";
import type { TileSkinId } from "./tileSkins";

export function sharedFileContent(
  skinId: TileSkinId,
  ent: Pick<Entitlements, "fichas" | "mesas">
): string {
  return JSON.stringify({
    v: 1,
    tileSkin: skinToSend(skinId, ent.fichas) ?? null,
    mesas: [...ent.mesas].sort(),
  });
}
