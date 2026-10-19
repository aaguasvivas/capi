# Incident 2026-10-17: a friend could not join by code

## What happened

Two friends sat side by side for one friend's first game. The host created a table in the iOS app and showed the 6-character code. The friend typed the code and could not press the join button. The host tapped Refresh in the waiting room and nothing changed. In the end the host texted the link, and the link worked.

## Root cause (confirmed in code and reproduced in the iOS simulator on 2026-10-18)

- **The join button was disabled until a name was typed, with no message.** This was true in the app (`apps/mobile/app/index.tsx`) and on playcapi.com (`apps/web/src/components/JoinGameForm.tsx`). The button only looked dim, and a tap did nothing. In the app the name field sits about two screens above the code field, inside what looks like the create form. A first-time player has no saved name (the 1.0 app never saved one).
- **In the app the keyboard covered the join button.** The screen scrolled only far enough to show the code field, and the Return key did not join.
- **Refresh gave no feedback.** The join request never left the friend's phone, so the host's Refresh had nothing new to show. It also showed no sign that it ran.
- **The link worked** because it opens the web join form with the code already filled in and the empty name field directly under it.
- Smaller problems found in the same review: the app kept spaces and dashes in a typed code (the web removes them), autocorrect was on in the code field, join errors showed above the create button, and the iMessage cards had the same silent name gate.

## The fix (owner's rule: flag what is missing at the field, like a form with required fields)

- Create and Join stay tappable on every surface (app home, app join card, web home, web table page, iMessage cards). A tap or the Return key checks the fields in order. Each missing or invalid field gets a red border and a message under it ("Escribe tu nombre para jugar.", "El código tiene 6 caracteres"). The first one scrolls into view and gets the cursor. The message clears when the player types. VoiceOver reads it.
- The code field keeps only letters and digits, in capitals, at most 6, as the player types. Autocorrect is off. Return joins.
- In the app, the join button stays visible above the keyboard.
- Server errors show under the button that caused them.
- Waiting room: Refresh shows "Buscando…", then "Nadie más se ha unido todavía." for 3 seconds, or a connection error. A new "Compartir invitación" button opens the share sheet with a ready message (link and code). Copy link stays as a second option.
- Commits: `276ffc2` (strings), `0b5045d` (fixes), `b21d4fa` (review fixes).

## Where it is live

- **playcapi.com:** live since 2026-10-18 and checked on the live site: an empty name is flagged and gets the cursor, a lowercase code is accepted, and a real join started the table.
- **iOS app and iMessage:** ships with version 1.2. The live 1.1 app keeps the old behavior until then. Until 1.2 is out, the most reliable way to invite from 1.1 is the link (Copy link), because it opens the fixed web form.

## Not fixed here (owner decisions or later work)

- **Invite links open the website, never the app.** Opening the app needs universal links: `ios.associatedDomains` in `apps/mobile/app.json` plus an `apple-app-site-association` file on playcapi.com (it returns 404 today).
- The app and the website start in Spanish whatever the device language is.
- A rate-limit answer reads as a generic join failure; a finished table found by code reads as "not found"; old empty lobbies stay listed on the home screen.
- If an iMessage player does not press send on the staged invite bubble, nothing reaches the chat, and the drawer gives no reminder.
