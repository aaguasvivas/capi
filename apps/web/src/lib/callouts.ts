import type { CalloutPayload, Seat } from "@capi/engine";
import type { Strings } from "@capi/i18n";

// Title of a +25 callout. A pase de salida travels as a "veinticinco" callout
// marked `salida`, so clients that predate it still show a +25 banner.
export function veinticincoLabel(payload: CalloutPayload | null, s: Strings): string {
  return payload?.salida === true ? s.calloutSalida : s.calloutVeinticinco;
}

// Tranque only: the blocker and the player to his right with the pips each
// held, then on equal pips who won it (the payload's winnerSeat). Tranques
// saved before winnerSeat show no tie line: that engine gave the tie to the
// compared seat on the opening side, not the opener. Tranques from before the
// comparison fields have no lines.
export function tranqueLines(
  p: CalloutPayload | null,
  nameOf: (seat: Seat) => string,
  s: Strings
): string[] {
  if (!p?.blockerSeat || !p.rivalSeat) return [];
  if (typeof p.blockerPips !== "number" || typeof p.rivalPips !== "number") return [];
  const lines = [
    s.tranqueCompare(nameOf(p.blockerSeat), p.blockerPips, nameOf(p.rivalSeat), p.rivalPips),
  ];
  if (p.blockerPips === p.rivalPips && p.winnerSeat) lines.push(s.tranqueTie(nameOf(p.winnerSeat)));
  return lines;
}
