// Seat tile designs: each seat may carry one premium design, and the other
// players draw that seat's face-down tiles in it. Clasico is never sent or
// stored; it means "no premium design". Pure module so it unit-tests without
// React Native.
import type { PremiumFichasId } from "./iapCatalog";
import type { TileSkinId } from "./tileSkins";

export const PREMIUM_FICHAS_IDS: readonly PremiumFichasId[] = [
  "quisqueya",
  "borinquen",
  "kingston",
];

export function asPremiumFichasId(v: unknown): PremiumFichasId | null {
  return (PREMIUM_FICHAS_IDS as readonly unknown[]).includes(v)
    ? (v as PremiumFichasId)
    : null;
}

// The design a seat's backs are drawn in: the seat's premium design, else
// the viewer's own design.
export function seatBackSkin(
  seatValue: unknown,
  viewerSkinId: TileSkinId
): TileSkinId {
  return asPremiumFichasId(seatValue) ?? viewerSkinId;
}

// The tileSkin a request carries: the picked design only when it is premium
// and owned. Undefined drops the key from a JSON body, so a player without a
// premium design sends exactly what older clients send.
export function skinToSend(
  skinId: TileSkinId,
  ownedFichas: ReadonlySet<PremiumFichasId>
): PremiumFichasId | undefined {
  const id = asPremiumFichasId(skinId);
  return id && ownedFichas.has(id) ? id : undefined;
}
