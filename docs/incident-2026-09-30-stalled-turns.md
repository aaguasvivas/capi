# Incident 2026-09-30: games stall with "nobody's turn"

## Report

Four bug reports in 20 minutes, all from the same player (Diego, seat s, the
1.0 App Store app), all in game 5cce9657, all with the text "No es turno de
nadie". Each report carries a valid server state: phase playing, a current
turn, a legal action for that seat.

## What happened

The move log and the chat log of the game show the same pattern four times:

| Stall | Last move (Diego) | Next move (Pato) | Wait |
|---|---|---|---|
| 1 | 00:38:55 draw then play | 00:41:40 | 166 s |
| 2 | 00:48:40 play | 00:50:48 | 128 s |
| 3 | 00:57:12 play | 00:57:51 | 39 s |
| 4 | 00:59:46 play | 01:00:17 | 31 s |

During each wait, both players sent "dale" (go) to each other many times. So
each screen showed the other player's turn. Pato's screen had missed Diego's
move: both the postgres_changes event and the mover's "state" broadcast on
chat-<gameId>. The server state was always correct.

A probe on the live project showed that realtime delivers both events within
0.4 s to a healthy socket, so the publication and the channels work. The miss
was on the receiving device: a socket that drops (screen lock, app switch,
network change) and rejoins loses every event sent while it was down.

## Why it did not recover

The 1.0 app (git 255a617) has no poll and no refetch when its channels rejoin.
It refetches only when the app comes back to the foreground. A missed move
therefore lasts until the player leaves the app and returns, which is what
ended each stall. In a 1v1 game nothing else can happen in the meantime,
because the only player who can act is the one whose screen is stale.

Web and the 1.1 app already refetched on a rejoin, but a socket can report
itself joined and still drop an event, and then they waited too.

## Fix (commits 978b7cc, 78122a0)

1. Web and app 1.1: a table that has heard of no newer state for 10 s fetches
   the row, and does it again every 10 s while it stays quiet (stops after 30
   quiet minutes). A stale screen catches up within about 10 s by itself.
2. The same fetch is relayed as a "state" message on chat-<gameId>. The 1.0
   app applies any newer state version from that message, so a 1.1 or web
   player unsticks a 1.0 opponent within about 10 s.
3. Server: the chat and bug-report routes push the current row on
   chat-<gameId> through the Realtime REST endpoint. Two 1.0 players who chat
   while stuck ("dale") heal each other at the first message.

## Verified live (playcapi.com, two clients)

- A Node copy of the 1.0 app's realtime logic missed a move on purpose and
  rejoined without a refetch: stale, as in the report. A chat from the other
  player healed it 1.8 s later.
- The same 1.0 copy against the real web page: the page relayed its fetch and
  the copy caught up 10.2 s after it fell behind, with no chat.
- The web page itself, with every realtime message dropped and the tab
  hidden: it went from "Turno de Capi QA B" to "Tu turno!" 11 s after the
  missed move.

## What 1.0 players still depend on

A 1.0 player against another 1.0 player heals only when one of them chats,
files a report, or leaves the app and returns. That ends when they update to
1.1.

## Stall audit (commit f5cadf0)

After the fix, five parallel audits read every end and hand-off path (engine,
web, app 1.1, iMessage, server routes), and a second reader checked each
finding before it was fixed.

Engine: packages/engine/__tests__/flow.endgame.test.ts plays 960 complete
seeded games (1v1 and 2v2, to 100 and 200, four move styles). After every
move it checks that the seat on turn has a legal action, that the game
finishes, that a round ends in round_over below the target and in finished
at it, and that the next round deals to the round winner. Every ending
occurs (dominó, capicúa, tranque with blocker, rival and tie wins, pase
corrido, pase de salida, a 1v1 draw that empties the boneyard). No defects.

Fixed:

- A full table could stay in the waiting room forever when its start write
  or answer was lost. GET and join now deal it.
- A rematch could delete the table its own link named when the link answer
  was lost, and every later rematch then failed.
- A join whose answer was lost left a seat no device held. The server now
  hands the seat back on a retry before the first move.
- Next round and claim were never broadcast; the routes now push them.
  Next round answers a stale client with stale:true and deals only from a
  round that ended. Claim takes the client's version and answers stale.
- A hung move request blocked every later tap; requests now time out after
  15 s and refetch.
- In the iMessage drawer, the result bubble waited for a tap on the DOMINÓ
  overlay, and a move whose answer was lost never sent its bubble. Both now
  go out when the device sees the state its own move produced.

Deferred to 1.1.1 (none stops a normal game):

1. iMessage: after a lost join answer the extension shows the watch view
   instead of joining again. Needs a pending-join retry in the extension (the
   server side is live).
2. iMessage: the first-turn bubble after a join depends on one GET. Needs the
   join answer to carry the dealt table, plus a retry.
3. Two 1.0 players who never chat: only a server-side scheduled relay
   (pg_cron with realtime.send) would reach them. Owner decision; needs SQL.
4. A 1.1 player can claim against a 1.0 player whose socket stayed dead for
   the whole 120 s window. Rare; the stuck player's screen then shows a loss.
5. A screen that misses a round end and then the next deal never shows that
   round's result card; the board redeals and the score jumps.
6. Spectators get no waiting line on the result cards and no rematch link.
7. A database error on the players lookup answers 403 instead of 500.
8. A double tap on Draw in the app plays the draw sound twice.
