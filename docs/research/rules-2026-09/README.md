# Dominican domino rules: research summary (2026-09-26)

Six researchers swept federation rulebooks, Dominican media, reference sites,
apps and discussion threads (605 claims, about 450 from pages actually opened
and explicitly about the Dominican game). One agent per topic weighed them, and
a second agent re-opened the key sources to check the conclusion. Raw claims:
`claims-*.json`; checked conclusions: `synthesis.json`.

Two rule sets exist, and Dominican sources name them:

- **Regla general** (tournaments, FID and FEMUNDO world rules, which the
  Dominican federation plays under): no bonuses at all. A hand scores only the
  tiles left; a match is won only by hand points reaching the target (200 at
  world level); a tranque is pair against pair.
- **Regla de patio** (how most Dominicans play at home): capicúa, pase de
  salida and pase corrido pay 25 (sometimes 30); a tranque is the blocker
  against the player on his right.

Capi plays patio rules. What the research says, topic by topic:

| Topic | Dominican patio rule | Confidence |
|---|---|---|
| Capicúa | The last tile of a domino could go on either open end. Not on a tranque. A double never counts (Wikipedia's Dominican section says so outright; one app, La Mesa, counts it). A non-double on two equal ends (5-6 on ends 5 and 5) counts under the literal wording; one app excludes it. Bonus 25, some tables 30. | medium |
| Pase corrido | The other three all pass after your tile: 25 (or 30) to your pair. Parejas only; no source covers 1v1. | medium |
| Pase de salida | The player after the opener cannot play on the opening tile: 25 (or 30) to the opener's pair, void if the opener's partner cannot play either. Not in Capi today. | medium |
| Bonus and the target | No Dominican source says whether a bonus can win the game. Federation play has no bonuses, so only hands win. | low |
| Tranque | Locked when the seventh tile of a suit is placed and both ends show that suit. Patio: the blocker compares pips with the next player (to his right); fewer pips wins for his pair. Regla general: pair totals. Points: all tiles left in all four hands (patio, FID). Ties vary (opening pair wins; draw; blocker wins). | medium |
| Scoring | Domino: all tiles left, partner included (patio, FID, Santiago tournament); some tables count only the opponents. Targets 100 or 200. | medium |
| Setup | 7 tiles each; all 28 in parejas; 1v1 draws from the pile; play goes to the right; the 6-6 opens the first hand; the round winner opens the next with any tile; you must play when you can. Capi already matches. | high |
| Other | Chuchazo is Puerto Rican, not Dominican. La caja is the 0-0 and el burro the 6-6, with no bonus. | medium |

## What changed in Capi (owner decisions of 2026-09-26)

- **Tranque:** detected the moment the locking tile is placed (no more waiting
  for four passes, which used to pay a pase corrido before every 2v2 tranque).
  The blocker compares pips with the next player; fewer pips wins the round
  for that pair and scores every tile left on the table. A tie goes to the
  pair that opened the round. The winner of the comparison opens the next
  round. Placing the locking tile as your last tile is a domino, not a
  tranque.
- **Bonuses and the target:** a pase corrido bonus only counts when it leaves
  the pair below the target. A game can only be won by winning a round.
- **Capicúa:** the last tile must fit both open ends; a non-double on two equal
  ends now counts. A double still does not, per the sources above (owner can
  flip this).

## Open for the owner

- Add the pase de salida (25, void if the opener's partner also passes)?
- Count a double as capicúa anyway (the owner's first instinct; one app does)?
- Tranque tie: opening pair wins (current), or nobody scores?
