# Privacy policy update for 1.1 (draft, needs Adelson's approval)

The live page at playcapi.com/privacy (apps/web/src/app/privacy/page.tsx) says
"no ads, no analytics SDKs, no tracking" and names only Supabase and Vercel.
Two parts of that are already out of date for the website today:

- The website sends error reports to Sentry. The production bundle on
  playcapi.com carries a Sentry DSN (checked 2026-09-26), and the iMessage
  extension loads that same web page, so the game inside Messages reports too.
- Problem reports go to the developer by email through Resend, and each one
  carries the message the player typed.

The 1.1 app adds more: the Google Mobile Ads SDK (AdMob), Google's consent form
(UMP), the App Tracking Transparency prompt, and Sentry wiring (the app reports
only once EAS has a DSN). AdMob also estimates a coarse location from the IP
address. The store sheet links this page, and App Review compares it with the
App Privacy answers in docs/m5-submission-checklist.md D3. Guideline 5.1.1(i)
also asks the policy to say how a user revokes consent and requests deletion,
and to confirm that third parties protect the data as well as the policy says.
This draft must go live before 1.1 is submitted.

What changes: the metadata description, the effective date, two replaced
sections ("Reportes de errores / Bug reports" and "Infraestructura /
Infrastructure"), five new sections ("Ads in the app", "Purchases", "Error
reports", "Your choices", "Deleting your data"), the replaced "What we don't
do" section, and the /support page wording. Everything else stays as it is.
Once approved, Claude applies it to the page, deploys, and checks it live.

## Metadata description

- ES + EN: "Política de privacidad de Capi: sin cuentas, anuncios solo en la app y siempre bajo tu control. Capi privacy policy: no accounts, ads only in the app, and always under your control."

## Effective date

- ES: "Vigente desde el <fecha de publicación> · Aplica a playcapi.com y a la app de Capi para iOS y Android"
- EN: "Effective <publish date> · Applies to playcapi.com and the Capi iOS and Android app"

## Replaced section: Reportar un problema / Report a problem

Replaces "Reportes de errores / Bug reports", which leaves out the typed
message and the email step.

ES:
> Los reportes son opcionales. Si usas el botón "Reportar un problema" dentro
> del juego, el reporte incluye el mensaje que escribes, el estado de la
> partida (con los apodos y las fichas de la mesa), los identificadores de la
> partida y de tu asiento, y datos básicos del dispositivo (navegador o
> sistema, versión de la app, dirección de la página, tamaño de pantalla e
> idioma). El servidor guarda el reporte y Resend se lo envía por correo al
> desarrollador. Los otros jugadores nunca lo ven.

EN:
> Reports are optional. If you use the "Report a problem" button inside the
> game, the report includes the message you type, the game state (with the
> nicknames and tiles at the table), the game and seat identifiers, and basic
> device info (browser or operating system, app version, page address, screen
> size, and language). The server stores the report and Resend emails it to
> the developer. Other players never see it.

## Replaced section: Infraestructura / Infrastructure

ES:
> Capi funciona sobre Supabase (base de datos y tiempo real) y Vercel
> (alojamiento). Sentry recibe los reportes automáticos de errores y Resend
> entrega por correo los reportes de problemas. Desde la versión 1.1, Google
> AdMob sirve los anuncios de la app. Los registros estándar del servidor
> pueden incluir direcciones IP por motivos de seguridad y operación. Capi
> solo les da a estos proveedores los datos que necesitan para prestar su
> servicio, y cada uno los protege al menos como describe esta política.

EN:
> Capi runs on Supabase (database and realtime) and Vercel (hosting). Sentry
> receives automatic error reports, and Resend delivers problem reports by
> email. Since version 1.1, Google AdMob serves the ads in the app. Standard
> server logs may include IP addresses for security and operations. Capi gives
> these providers only the data they need to provide their service, and each
> of them protects it at least as well as this policy describes.

Approval note: the last sentence is the "equal protection" confirmation that
guideline 5.1.1(i) asks for. Check each provider's data processing terms
(Supabase, Vercel, Sentry, Resend, Google) before approving it.

## New section: Anuncios en la app / Ads in the app

ES:
> Desde la versión 1.1, la app muestra un anuncio pequeño en la pantalla de
> inicio y en la sala de espera, nunca durante la partida. Los anuncios los
> sirve Google AdMob. Para mostrar y medir anuncios, el SDK de Google puede
> usar el identificador de publicidad del dispositivo, datos de interacción
> con los anuncios, datos de diagnóstico y rendimiento, y tu dirección IP, con
> la que estima tu ubicación aproximada (ciudad o región). La app no pide
> permiso de ubicación, así que Google no recibe tu ubicación exacta. En las
> regiones que lo requieren, Google te pide tu consentimiento antes. El
> identificador de publicidad solo se usa si permites el rastreo en el aviso
> de iOS; si no lo permites, Google no lo recibe. La web playcapi.com y el
> juego dentro de iMessage no muestran anuncios. Si compras "Quitar anuncios"
> o "Todo Capi", la app deja de cargar el SDK de anuncios. La política de
> Google está en policies.google.com/privacy.

EN:
> Since version 1.1, the app shows one small ad on the home screen and in the
> waiting room, never during a game. Ads are served by Google AdMob. To show
> and measure ads, Google's SDK may use the device advertising identifier, ad
> interaction data, diagnostics and performance data, and your IP address,
> which it uses to estimate your approximate location (city or region). The
> app never asks for location permission, so Google does not get your exact
> location. In regions that require it, Google asks for your consent first.
> The advertising identifier is used only if you allow tracking in the iOS
> prompt; if you do not, Google does not receive it. The playcapi.com website
> and the game inside iMessage show no ads. If you buy "Remove Ads" or "Todo
> Capi", the app stops loading the ads SDK. Google's policy is at
> policies.google.com/privacy.

## New section: Compras / Purchases

ES:
> Las compras dentro de la app (diseños de mesa y fichas, Quitar anuncios, Todo
> Capi) las procesa Apple. Capi no recibe tu nombre, tu correo ni tus datos de
> pago; solo sabe qué artículos están desbloqueados en tu dispositivo.

EN:
> In-app purchases (table and tile designs, Remove Ads, Todo Capi) are processed
> by Apple. Capi never receives your name, email, or payment details; it only
> knows which items are unlocked on your device.

## New section: Reportes automáticos de errores / Error reports

ES:
> Cuando algo falla, la web playcapi.com (y con ella el juego dentro de
> iMessage) envía a Sentry un reporte técnico del error: el mensaje de error,
> el navegador y el sistema, y la página donde pasó. La app puede enviar
> reportes parecidos (tipo de dispositivo, versión del sistema y de la app, y
> el error técnico) cuando se cierra por un fallo. Capi no añade a estos
> reportes tu apodo ni el contenido de tus partidas, y Sentry no graba tu
> pantalla.

EN:
> When something breaks, the playcapi.com website (and with it the game inside
> iMessage) sends Sentry a technical report of the error: the error message,
> the browser and operating system, and the page where it happened. The app
> may send similar reports (device type, OS and app version, and the technical
> error) when it crashes. Capi does not add your nickname or your games to
> these reports, and Sentry does not record your screen.

## New section: Tus opciones / Your choices

ES:
> Puedes cambiar de opinión cuando quieras:
> - Rastreo: en iOS, ve a Ajustes > Privacidad y seguridad > Rastreo y apaga
>   Capi. Desde ese momento Google no recibe el identificador de publicidad.
> - Consentimiento de anuncios: en las regiones donde Google pide
>   consentimiento, abre la tienda de la app y toca "Opciones de privacidad de
>   anuncios" para cambiar tu elección.
> - Sin anuncios: "Quitar anuncios" o "Todo Capi" apagan el SDK de anuncios.

EN:
> You can change your mind at any time:
> - Tracking: on iOS, go to Settings > Privacy & Security > Tracking and turn
>   Capi off. From then on Google does not receive the advertising identifier.
> - Ad consent: in regions where Google asks for consent, open the store in
>   the app and tap "Ad privacy options" to change your choice.
> - No ads: "Remove Ads" or "Todo Capi" turns the ads SDK off.

Approval note: the "Ad privacy options" link is in the store sheet of the
polish-pass build (apps/mobile/components/StoreSheet.tsx, shown only where
Google requires it). If that build does not ship with it, drop the second
bullet in both languages.

## New section: Borrar tus datos / Deleting your data

ES:
> No hay cuentas, así que tus datos se identifican por el código de la
> partida. Para pedir que borremos una partida, tu apodo en ella o un reporte
> que enviaste, escribe a adelsonaguasvivas@gmail.com con el código de la
> partida y tu apodo. Borramos esos datos y te lo confirmamos por correo.

EN:
> There are no accounts, so your data is identified by the game code. To ask
> us to delete a game, your nickname in it, or a report you sent, email
> adelsonaguasvivas@gmail.com with the game code and your nickname. We delete
> that data and confirm by email.

Approval note: decide whether to promise a time frame (for example "within 30
days"). The draft makes no time promise.

## Replaced section: Lo que no hacemos / What we don't do

ES:
> No vendemos tus datos. No hay chat de texto libre entre jugadores. Fuera de
> los anuncios de la app descritos arriba, no hay rastreo ni SDKs de
> analítica. Los datos de las partidas existen solo para operar el juego y
> pueden borrarse con el tiempo.

EN:
> We never sell your data. There is no free-text chat between players. Apart
> from the in-app ads described above, there is no tracking and there are no
> analytics SDKs. Game data exists only to operate the game and may be deleted
> over time.

## /support page (apps/web/src/app/support/page.tsx)

- Intro. Now: "sin cuenta y gratis" / "free and with no account". Suggested:
  "sin cuenta y gratis, con compras opcionales de diseños en la app" / "free,
  with no account, and with optional design purchases in the app".
- First help bullet. Now it calls it "the bug report button". Suggested:
  > ES: Lo más rápido es el botón "Reportar un problema" dentro del juego. Le
  > llega al equipo de Capi, no a tu oponente, con el estado de la partida
  > para poder reproducir el problema.
  >
  > EN: The fastest way is the "Report a problem" button inside the game. It
  > goes to the Capi team, not to your opponent, with the game state attached
  > so the problem can be reproduced.
- New bullet. Suggested:
  > ES: Para borrar tus datos de una partida, escribe a <Email /> con el
  > código de la partida.
  >
  > EN: To delete your data from a game, email <Email /> with the game code.

## Also

- The "Lo que guarda el servidor / What the server stores" and "Niños /
  Children" sections stay as they are; both stay true with the sections above.
- The "Error reports" section says "may" for the app, so it stays true whether
  or not the app's Sentry DSN is set for 1.1.
