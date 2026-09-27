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
| Pase de salida | The player after the opener cannot play on the opening tile: 25 (or 30) to the opener's pair, void if the opener's partner cannot play either. In Capi since 2026-09-27 (see the follow-up below). | medium |
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
  tranque. (The tie changed on 2026-09-27, see below.)
- **Bonuses and the target:** a pase corrido bonus only counts when it leaves
  the pair below the target. A game can only be won by winning a round.
- **Capicúa:** the last tile must fit both open ends; a non-double on two equal
  ends now counts. A double still does not, per the sources above (owner can
  flip this).

## 2026-09-27 follow-up: pase de salida and the tranque tie

A second run answered two questions in detail: every part of the pase de
salida, and the tranque tie. Five sweeps by source kind (Spanish web, forums
and video, apps and code, tournaments, English web), a fact checker on each
sweep's key claims, one synthesis and one critic. Everything is in
`salida-and-tie-2026-09-27.json`; the critic's corrections are folded in
below.

What the sources say:

| Question | Finding | Confidence |
|---|---|---|
| Salida trigger | A patio rule (Wikipedia es patio, DR1 "25, 50, Capicua!", Santiago 2019 tournament, FichaFlow). It fires when the opening tile is alone on the board and the next player cannot play on it. A later pass never counts. Not universal: the 2025 La Guáyiga tournament rules and the DR1 forum thread do not list it. | high |
| Salida cancel | Void when the opener's partner cannot play either (DR1, Wikipedia es: "se anulan los puntos de salida"). No other cancel is given. | high |
| When it pays | The bonus depends on the partner's action, so it is final only when the partner plays. No source says when it is written down. | medium |
| Every hand, forced 6-6 | The first tile of a hand, with no exception for the 6-6 that opens the first hand. Two apps apply it to every hand; the prose sources are not explicit. | medium |
| Value | 25 has the most support (Wikipedia es "25 o 30" at targets 100 or 200, Santiago 2019, FichaFlow default). DR1 alone scales it: 10 for games to 200 or 250, 25 for 500, and no value for 100. | medium |
| All three pass | No source describes it. The partner's pass cancels the salida and the fourth pass is a pase corrido, so it pays 25 once. Two apps pay both bonuses. | medium |
| 1v1, target cap | No Dominican source on either. | low |
| Tranque tie | No Dominican source states the tie for the blocker against the player on his right. DR1 gives it to the player who placed the first tile (la mano), and his team takes the points, but the sentence may belong to its "tranquar con todo el mundo" variant. Pair-against-pair sources give it to the pair that opened. Blocker wins in two apps (FichaFlow, as its own house rule, and a hobby engine). The Santiago 2019 tournament scores nothing on a tie. | low |
| Opener after a tie | The winner of a hand opens the next (Wikipedia es, Domino RD, La Mesa). Under DR1 that is the player who opened the tied hand. | medium |

What Capi does now (owner decisions of 2026-09-27):

- **Pase de salida, 2v2 only:** when the opening tile is the only tile on the
  board and the player after the opener passes, the opener's side gets +25
  the moment the opener's partner plays. If the partner passes too, nothing
  is paid, and if the fourth player also passes the pase corrido pays 25
  once. It counts every round, including the first, where the 6-6 is placed
  automatically. It pays only while it leaves the side below the target, so
  it never wins the game. On the wire it is a "veinticinco" callout marked
  `salida`: older app builds show it as ¡VEINTICINCO! +25 for the right
  side, and current clients title the banner ¡PASE DE SALIDA!.
- **Tranque tie:** the blocker still counts against the player on his right,
  and fewer pips wins for that player's side. On equal pips the player who
  opened the round wins, his side takes every pip left, and he opens the next
  round, even when he is neither the blocker nor the rival. The winning side
  is the same as before; the next opener can differ. The round card names him
  under the comparison line.

## Open for the owner

- Count a double as capicúa anyway (the owner's first instinct; one app does)?
- Pase de salida value: 25 flat (current, Wikipedia es), or DR1's 10 for games
  to 200 or 250 (DR1 gives no value for games to 100)?
- Show a notice at the triggering pass? Capi shows only the pass until the
  partner plays.
- Tranque points: every pip in all hands (current) or only the opponents'
  pips? No confirmed Dominican prose source was re-read on this point.
