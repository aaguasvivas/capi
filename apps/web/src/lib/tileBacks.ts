import { premiumTileSkin } from "./validation";

// The four tile designs, as the app names them (apps/mobile/lib/tileSkins.tsx).
// The web has no picker: a viewer's own design is the premium one stored on
// their seat row, else clasico.
export type TileSkinId = "clasico" | "quisqueya" | "borinquen" | "kingston";

// The design a viewer draws another seat's face-down tiles in: that seat's
// premium design, else the viewer's own. Faces never follow the seat.
export function seatBackSkin(seatValue: unknown, viewer: TileSkinId): TileSkinId {
  return premiumTileSkin(seatValue) ?? viewer;
}
