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
