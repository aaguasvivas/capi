# Items 1 to 4 after 1.1: design and contracts

Source list and decisions: `docs/ideas-after-1.1.md`. This file fixes the contracts that the server, the web, the app, and the iMessage extension share. Code and tests follow it.

## Item 1: other players see your tile backs

### Rule

- Each seat may carry one premium tile design: `quisqueya`, `borinquen`, or `kingston`. Clasico is never stored; it means "no premium design".
- A viewer draws each other seat's face-down tiles in that seat's premium design. A seat with no premium design is drawn in the viewer's own design.
- The viewer's own design: in the app, the design picked on the home screen (`useTileSkin`). On the web (including the iMessage web view), the premium design on the viewer's own seat row, else clasico. A spectator on the web uses clasico.
- Faces (the viewer's hand and the board) stay in the viewer's own design. Only backs follow the seat.

### Database (migration 007)

- `public.players.tile_skin text null`, check `tile_skin is null or tile_skin in ('quisqueya','borinquen','kingston')`.
- File: `supabase/migrations/007_player_tile_skin.sql`. Undo: `supabase/rollbacks/007_undo_player_tile_skin.sql`.
- Adelson runs 007 in the Supabase SQL Editor before the first 1.2 app build goes to TestFlight. The web that writes the column went live first (live by 2026-10-18, probed 2026-10-19) and is harmless without it: the insert carries `tile_skin` only for a premium design, and no web or 1.1 client sends one. Without the column, a 1.2 player with a premium tile design cannot create or join (HTTP 500, audit probe 2026-10-19).

### API

- Request field `tileSkin` (string) on `POST /api/games` (create), `POST /api/games/[id]/join`, and `POST /api/games/[id]/rematch`.
- The server keeps the value only when it is one of the three premium ids. Anything else (missing, `clasico`, unknown) is treated as no premium design.
- The insert includes the `tile_skin` key only when there is a premium value. A body without a premium design inserts exactly the columns it inserts today. So older clients and an un-migrated database behave as today.
- Rematch: the new seat's design is the body's `tileSkin` when it is premium, else the original seat row's `tile_skin` (the web page in iMessage and the 1.0/1.1 apps send only `playerId`).
- The join hand-back path (a seat with no moves yet) writes nothing. Identity matching (nickname plus avatar color) does not include the design.
- `GET /api/games/[id]` already returns `select('*')` players, so clients get `tile_skin` with no route change. Clients refetch players on a players INSERT, so the value must be set at insert time, never by a later update.

### Clients

- The app sends `tileSkin` only when the picked design is premium and owned (`ent.fichas.has(id)`).
- The extension sends the `tileSkin` the app wrote to the shared file (below).
- The web sends nothing (it has no designs).
- App: the top hand row (1v1 opponent, 2v2 partner, spectator view) renders inside `SkinScope` with the resolved seat design. Each 2v2 side rail shows one small back in that seat's design.
- Web: the four back designs are ported to DOM SVG. The top row and each 2v2 side column use the resolved seat design. Clasico on the web keeps today's exact look.
- Spectator seat lists stay count-only.

## Item 2: Smart App Banner

- Root layout metadata: `itunes: { appId: "6794404340" }`, site-wide. No `app-argument`: the banner opens the app on its home screen. Since 55d5346 (2026-10-19) the app has universal links, but only for invite links (`https://playcapi.com/?join=<table>`, which open the table's join card); a per-page `app-argument` is not built.
- Safari on iPhone shows the banner. WKWebView (the iMessage drawer) ignores it.

## Item 3: store preview

- In the store sheet, a tap on a mesa row, a fichas row, or a thumbnail in the Todo Capi strip opens a full preview inside the same sheet (a view swap, not a second modal). The preview has Back, the large preview, the name and description, and the Buy button (or the owned state).
- Fichas preview, all in the design on sale: a row of face-up tiles ("Tus fichas" / "Your tiles"), a row of backs ("Lo que ven los demás" / "What the others see"), and a short line of tiles on a felt ("En la mesa" / "On the table").
- Mesa preview: the felt at full width in the table's gradient, its watermark, a few tiles, and a score bar in the table's colors, close to the game screen.
- The fichas row thumbnail shows one face and one back.
- A tap on a locked design on the home screen opens the store directly on that design's preview. A purchase from the preview keeps today's behavior: the home screen selects the bought design and closes the store.
- Strings come from `packages/i18n` only.

## Item 4: iMessage score and table

- The create card gets a 100 / 200 segmented picker and a table picker (menu style), on one row. The table list is the three free tables plus the premium tables the player owns. No locked tables, prices, or store links in the extension (guideline 4.4).
- The extension remembers the last score and table (App Group defaults keys `capi_target_score` and `capi_table`). A remembered premium table that is no longer in the owned list falls back to Barberia.
- The invite bubble keeps its caption and its code subcaption. The score goes in `trailingSubcaption` ("100 pts" / "200 puntos").
- New mirrored Swift strings: `table`, `score100`, `score200`, `themeBarberia`, `themeColmado`, `themePatio`, `themeQuisqueya`, `themeLarimar`, `themeNoche`. `swiftParity.test.ts` checks them.

### Shared file from the app to the extension

- The app writes `capi-shared.json` in the App Group container `group.dev.capi.app` through the local native module `CapiShared` (`apps/mobile/modules/capi-shared`), which calls `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` and writes atomically. Not `expo-file-system/next`: its permission check compares the `/private/var` and `/var` forms of the container path, so the first write on a device is refused (found in review, 2026-10-15).
- Shape: `{"v":1,"tileSkin":"quisqueya"|null,"mesas":["larimar","quisqueya"]}`. `tileSkin` is the picked design only when it is premium and owned. `mesas` lists the owned premium tables, sorted.
- The app writes it after entitlements hydrate and whenever entitlements or the picked design change. iOS only; Expo Go and Android have no module, so the write is skipped. A failed write is reported once (console in development, a Sentry warning in production) and never thrown.
- The extension reads it with `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`. A missing or bad file means no premium design and no premium tables. The extension validates every value against the known ids.
- Cross-process sharing works only on signed builds. Verify it on a TestFlight build, not in the simulator.

## Rollout order

1. Push the web (banner, API, web backs). It goes live in the 1.1 iMessage drawer too, so the drawer layout is checked first. Done before 007 (live by 2026-10-18); harmless, see Database above.
2. Adelson runs migration 007.
3. Build the app (version 1.2.0), test on TestFlight (App Group, purchases, previews), submit. The step list is `docs/submit-1.2-runbook.md`.
