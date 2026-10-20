# Privacy policy update for 1.2 (draft, waits for Adelson's approval)

The live page at playcapi.com/privacy (apps/web/src/app/privacy/page.tsx) is
the 1.1 text (approved 2026-09-26). Two things in 1.2 are not on it yet:

- The server stores the premium tile design a player uses at a table
  (`players.tile_skin`, migration 007), so the other players see that design
  on the player's tile backs. The server has stored the premium table design
  on the game since 1.1 (`games.theme`), and the page does not list that
  either. One new bullet covers both.
- The app tells the server which premium design a player uses at a table, and
  the iMessage extension does the same for games started in Messages. On the
  device, the app writes a file to the App Group (`capi-shared.json`) that
  tells the extension which premium tables the player owns and which tile
  design the player uses. The file never leaves the device.

The English text also names the bundle by its English product name, "All of
Capi" (docs/m5-asc-iap-setup.md), not "Todo Capi". The Spanish text keeps
"Todo Capi".

What changes: the effective date, one new bullet in "Lo que guarda el servidor
/ What the server stores", the "Compras / Purchases" paragraph, and in English
only, "Todo Capi" becomes "All of Capi" in "Ads in the app" and "Your
choices". Everything else stays as it is. Once approved, Claude applies it to
the page, deploys, and checks it live before 1.2 is submitted
(docs/submit-1.2-runbook.md step 5).

## App Privacy in App Store Connect: no change

`players.tile_skin` is covered by the existing Gameplay Content entry (Not
Linked to You, App Functionality), the same entry that has covered
`games.theme` since 1.1. Apple defines Gameplay Content as "saved games,
multiplayer matching or gameplay logic, or user-generated content in-game".
The value has no account, receipt, or device identifier next to it (a players
row holds the seat, nickname, avatar color, game id and the design), so it is
not Purchase History, which Apple defines as an account's or individual's
purchases. The 1.1 label with this reasoning was accepted for `games.theme`.
Evidence: docs/audits/2026-10-19/evidence/refute-privacy-tileskin/notes.txt
(not published).

## Effective date

The day the page goes live, in both languages.

ES, replaces the line under "Política de privacidad":

```tsx
            <p className="text-xs font-medium text-gray-400">
              Vigente desde el [día] de [mes] de 2026 · Aplica a playcapi.com
              y a la app de Capi para iOS y Android
            </p>
```

EN, replaces the line under "Privacy Policy":

```tsx
            <p className="text-xs font-medium text-gray-400">
              Effective [Month day], 2026 · Applies to playcapi.com and the
              Capi iOS and Android app
            </p>
```

Fill in the date when the page goes live (for example "Vigente desde el 22 de
octubre de 2026" and "Effective October 22, 2026") in place of the bracketed parts.

## New bullet: Lo que guarda el servidor / What the server stores

Goes after the moves-and-scores bullet, in both languages.

ES:
> El diseño premium de mesa y de fichas que uses en una partida, si tienes
> uno, para que los demás jugadores lo vean.

```tsx
              <li>Las jugadas y puntuaciones de cada partida.</li>
              <li>
                El diseño premium de mesa y de fichas que uses en una partida,
                si tienes uno, para que los demás jugadores lo vean.
              </li>
```

EN:
> The premium table and tile design you use in a game, if you have one, so
> the other players see it.

```tsx
              <li>Game moves and scores.</li>
              <li>
                The premium table and tile design you use in a game, if you
                have one, so the other players see it.
              </li>
```

The closing sentence of the section ("Nada de esto está vinculado a tu
identidad real." / "None of this is linked to your real identity.") stays
true and stays.

## Replaced paragraph: Compras / Purchases

ES:
> Las compras dentro de la app (diseños de mesa y fichas, Quitar anuncios,
> Todo Capi) las procesa Apple. Capi no recibe tu nombre, tu correo ni tus
> datos de pago; solo sabe qué artículos están desbloqueados en tu
> dispositivo. Cuando juegas con un diseño premium, la app (o la extensión de
> iMessage) le dice al servidor qué diseño usas en esa mesa. En tu
> dispositivo, la app también le dice a la extensión de iMessage qué mesas
> premium tienes y qué diseño de fichas usas, para que puedas jugar con ellos
> en iMessage.

```tsx
          <Section title="Compras">
            <p>
              Las compras dentro de la app (diseños de mesa y fichas, Quitar
              anuncios, Todo Capi) las procesa Apple. Capi no recibe tu nombre,
              tu correo ni tus datos de pago; solo sabe qué artículos están
              desbloqueados en tu dispositivo. Cuando juegas con un diseño
              premium, la app (o la extensión de iMessage) le dice al servidor
              qué diseño usas en esa mesa. En tu dispositivo, la app también le
              dice a la extensión de iMessage qué mesas premium tienes y qué
              diseño de fichas usas, para que puedas jugar con ellos en
              iMessage.
            </p>
          </Section>
```

EN:
> In-app purchases (table and tile designs, Remove Ads, All of Capi) are
> processed by Apple. Capi never receives your name, email, or payment
> details; it only knows which items are unlocked on your device. When you
> play with a premium design, the app (or the iMessage extension) tells the
> server which design you use at that table. On your device, the app also
> tells the iMessage extension which premium tables you own and which tile
> design you use, so you can play with them in iMessage.

```tsx
          <Section title="Purchases">
            <p>
              In-app purchases (table and tile designs, Remove Ads, All of
              Capi) are processed by Apple. Capi never receives your name,
              email, or payment details; it only knows which items are unlocked
              on your device. When you play with a premium design, the app (or
              the iMessage extension) tells the server which design you use at
              that table. On your device, the app also tells the iMessage
              extension which premium tables you own and which tile design you
              use, so you can play with them in iMessage.
            </p>
          </Section>
```

Approval note: the brief for this draft said "which designs you own". The
text says "which premium tables you own and which tile design you use",
because that is what the file holds: every owned premium table, but only the
one tile design the player picked (apps/mobile/lib/sharedPayload.ts).

## English only: "Todo Capi" becomes "All of Capi"

"Ads in the app", last sentences:

```tsx
              iMessage show no ads. If you buy &quot;Remove Ads&quot; or
              &quot;All of Capi&quot;, the app stops loading the ads SDK.
              Google&apos;s policy is at policies.google.com/privacy.
```

"Your choices", third bullet:

```tsx
              <li>
                No ads: &quot;Remove Ads&quot; or &quot;All of Capi&quot; turns
                the ads SDK off.
              </li>
```

## Also

- The metadata description, "Infraestructura / Infrastructure", "Borrar tus
  datos / Deleting your data", "Lo que no hacemos / What we don't do" and
  "Niños / Children" stay as they are; each stays true with the changes above.
- Deleting a game also deletes its players rows, and with them the stored
  tile design, so "Borrar tus datos / Deleting your data" needs no new words.
- The /support page needs no change for 1.2.
