import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad / Privacy",
  description:
    "Política de privacidad de Capi: sin cuentas, anuncios solo en la app y siempre bajo tu control. Capi privacy policy: no accounts, ads only in the app, and always under your control.",
};

const GOLD = "#b8860b";

function LangTag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.18em] text-white">
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-gray-600">
        {children}
      </div>
    </section>
  );
}

function Email() {
  return (
    <a
      href="mailto:adelsonaguasvivas@gmail.com"
      className="font-semibold text-gray-800 underline decoration-2 underline-offset-2"
      style={{ textDecorationColor: GOLD }}
    >
      adelsonaguasvivas@gmail.com
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f0e8] via-[#f0ebe3] to-[#e8d5c0] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-xl space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <Link
            href="/"
            className="inline-block text-3xl font-black tracking-tight text-gray-900 drop-shadow-sm"
          >
            Capi
          </Link>
          <div
            aria-hidden
            className="mx-auto h-[3px] w-10 rounded-full"
            style={{ background: GOLD }}
          />
          <p className="text-[11px] font-bold tracking-[0.22em] text-gray-500 uppercase pt-1">
            Política de privacidad · Privacy Policy
          </p>
        </header>

        {/* Español */}
        <article
          lang="es"
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-5"
        >
          <div className="space-y-2">
            <LangTag>ES</LangTag>
            <h2 className="text-xl font-black tracking-tight text-gray-900">
              Política de privacidad
            </h2>
            <p className="text-xs font-medium text-gray-400">
              Vigente desde el 26 de septiembre de 2026 · Aplica a playcapi.com
              y a la app de Capi para iOS y Android
            </p>
            <p className="text-sm leading-relaxed text-gray-600">
              Capi es un juego de dominó dominicano en línea. Esta página
              explica qué datos se usan para que el juego funcione.
            </p>
          </div>

          <Section title="Sin cuentas">
            <p>
              No hay cuentas, ni inicio de sesión, ni contraseñas. Solo eliges
              un apodo en cada partida.
            </p>
          </Section>

          <Section title="Lo que guarda el servidor">
            <p>Para que el multijugador en línea funcione, el servidor guarda:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tu apodo y el color de tu avatar.</li>
              <li>Las jugadas y puntuaciones de cada partida.</li>
              <li>
                Las frases de chat rápido que elijas. Solo hay frases
                predefinidas, no existe chat de texto libre.
              </li>
            </ul>
            <p>
              Las partidas se identifican con códigos de invitación aleatorios.
              Nada de esto está vinculado a tu identidad real.
            </p>
          </Section>

          <Section title="Anuncios en la app">
            <p>
              Desde la versión 1.1, la app muestra un anuncio pequeño en la
              pantalla de inicio y en la sala de espera, nunca durante la
              partida. Los anuncios los sirve Google AdMob. Para mostrar y
              medir anuncios, el SDK de Google puede usar el identificador de
              publicidad del dispositivo, datos de interacción con los
              anuncios, datos de diagnóstico y rendimiento, y tu dirección IP,
              con la que estima tu ubicación aproximada (ciudad o región). La
              app no pide permiso de ubicación, así que Google no recibe tu
              ubicación exacta. En las regiones que lo requieren, Google te
              pide tu consentimiento antes. El identificador de publicidad solo
              se usa si permites el rastreo en el aviso de iOS; si no lo
              permites, Google no lo recibe. La web playcapi.com y el juego
              dentro de iMessage no muestran anuncios. Si compras &quot;Quitar
              anuncios&quot; o &quot;Todo Capi&quot;, la app deja de cargar el
              SDK de anuncios. La política de Google está en
              policies.google.com/privacy.
            </p>
          </Section>

          <Section title="Compras">
            <p>
              Las compras dentro de la app (diseños de mesa y fichas, Quitar
              anuncios, Todo Capi) las procesa Apple. Capi no recibe tu nombre,
              tu correo ni tus datos de pago; solo sabe qué artículos están
              desbloqueados en tu dispositivo.
            </p>
          </Section>

          <Section title="Reportar un problema">
            <p>
              Los reportes son opcionales. Si usas el botón &quot;Reportar un
              problema&quot; dentro del juego, el reporte incluye el mensaje
              que escribes, el estado de la partida (con los apodos y las
              fichas de la mesa), los identificadores de la partida y de tu
              asiento, y datos básicos del dispositivo (navegador o sistema,
              versión de la app, dirección de la página, tamaño de pantalla e
              idioma). El servidor guarda el reporte y Resend se lo envía por
              correo al desarrollador. Los otros jugadores nunca lo ven.
            </p>
          </Section>

          <Section title="Reportes automáticos de errores">
            <p>
              Cuando algo falla, la web playcapi.com (y con ella el juego
              dentro de iMessage) envía a Sentry un reporte técnico del error:
              el mensaje de error, el navegador y el sistema, y la página donde
              pasó. La app puede enviar reportes parecidos (tipo de
              dispositivo, versión del sistema y de la app, y el error técnico)
              cuando se cierra por un fallo. Capi no añade a estos reportes tu
              apodo ni el contenido de tus partidas, y Sentry no graba tu
              pantalla.
            </p>
          </Section>

          <Section title="Infraestructura">
            <p>
              Capi funciona sobre Supabase (base de datos y tiempo real) y
              Vercel (alojamiento). Sentry recibe los reportes automáticos de
              errores y Resend entrega por correo los reportes de problemas.
              Desde la versión 1.1, Google AdMob sirve los anuncios de la app.
              Los registros estándar del servidor pueden incluir direcciones IP
              por motivos de seguridad y operación. Capi solo les da a estos
              proveedores los datos que necesitan para prestar su servicio, y
              cada uno los protege al menos como describe esta política.
            </p>
          </Section>

          <Section title="Tus opciones">
            <p>Puedes cambiar de opinión cuando quieras:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Rastreo: en iOS, ve a Ajustes &gt; Privacidad y seguridad &gt;
                Rastreo y apaga Capi. Desde ese momento Google no recibe el
                identificador de publicidad.
              </li>
              <li>
                Consentimiento de anuncios: en las regiones donde Google pide
                consentimiento, abre la tienda de la app y toca &quot;Opciones
                de privacidad de anuncios&quot; para cambiar tu elección.
              </li>
              <li>
                Sin anuncios: &quot;Quitar anuncios&quot; o &quot;Todo
                Capi&quot; apagan el SDK de anuncios.
              </li>
            </ul>
          </Section>

          <Section title="Borrar tus datos">
            <p>
              No hay cuentas, así que tus datos se identifican por el código de
              la partida. Para pedir que borremos una partida, tu apodo en ella
              o un reporte que enviaste, escribe a <Email /> con el código de
              la partida y tu apodo. Borramos esos datos y te lo confirmamos
              por correo.
            </p>
          </Section>

          <Section title="Lo que no hacemos">
            <p>
              No vendemos tus datos. No hay chat de texto libre entre
              jugadores. Fuera de los anuncios de la app descritos arriba, no
              hay rastreo ni SDKs de analítica. Los datos de las partidas
              existen solo para operar el juego y pueden borrarse con el
              tiempo.
            </p>
          </Section>

          <Section title="Niños">
            <p>
              El juego es apto para todas las edades y no recoge de nadie más
              datos que los descritos aquí.
            </p>
          </Section>

          <Section title="Cambios">
            <p>Cualquier cambio a esta política se publicará en esta página.</p>
          </Section>

          <Section title="Contacto">
            <p>
              Escríbenos a <Email />.
            </p>
          </Section>
        </article>

        {/* English */}
        <article
          lang="en"
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-5"
        >
          <div className="space-y-2">
            <LangTag>EN</LangTag>
            <h2 className="text-xl font-black tracking-tight text-gray-900">
              Privacy Policy
            </h2>
            <p className="text-xs font-medium text-gray-400">
              Effective September 26, 2026 · Applies to playcapi.com and the
              Capi iOS and Android app
            </p>
            <p className="text-sm leading-relaxed text-gray-600">
              Capi is an online Dominican dominoes game. This page explains
              what data is used to make the game work.
            </p>
          </div>

          <Section title="No accounts">
            <p>
              There are no accounts, no sign-in, and no passwords. You just
              pick a nickname each game.
            </p>
          </Section>

          <Section title="What the server stores">
            <p>To run online multiplayer, the server stores:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your nickname and avatar color.</li>
              <li>Game moves and scores.</li>
              <li>
                The quick-chat phrases you pick. Only predefined phrases exist,
                there is no free-text chat.
              </li>
            </ul>
            <p>
              Games are identified by random invite codes. None of this is
              linked to your real identity.
            </p>
          </Section>

          <Section title="Ads in the app">
            <p>
              Since version 1.1, the app shows one small ad on the home screen
              and in the waiting room, never during a game. Ads are served by
              Google AdMob. To show and measure ads, Google&apos;s SDK may use
              the device advertising identifier, ad interaction data,
              diagnostics and performance data, and your IP address, which it
              uses to estimate your approximate location (city or region). The
              app never asks for location permission, so Google does not get
              your exact location. In regions that require it, Google asks for
              your consent first. The advertising identifier is used only if
              you allow tracking in the iOS prompt; if you do not, Google does
              not receive it. The playcapi.com website and the game inside
              iMessage show no ads. If you buy &quot;Remove Ads&quot; or
              &quot;Todo Capi&quot;, the app stops loading the ads SDK.
              Google&apos;s policy is at policies.google.com/privacy.
            </p>
          </Section>

          <Section title="Purchases">
            <p>
              In-app purchases (table and tile designs, Remove Ads, Todo Capi)
              are processed by Apple. Capi never receives your name, email, or
              payment details; it only knows which items are unlocked on your
              device.
            </p>
          </Section>

          <Section title="Report a problem">
            <p>
              Reports are optional. If you use the &quot;Report a
              problem&quot; button inside the game, the report includes the
              message you type, the game state (with the nicknames and tiles at
              the table), the game and seat identifiers, and basic device info
              (browser or operating system, app version, page address, screen
              size, and language). The server stores the report and Resend
              emails it to the developer. Other players never see it.
            </p>
          </Section>

          <Section title="Error reports">
            <p>
              When something breaks, the playcapi.com website (and with it the
              game inside iMessage) sends Sentry a technical report of the
              error: the error message, the browser and operating system, and
              the page where it happened. The app may send similar reports
              (device type, OS and app version, and the technical error) when
              it crashes. Capi does not add your nickname or your games to
              these reports, and Sentry does not record your screen.
            </p>
          </Section>

          <Section title="Infrastructure">
            <p>
              Capi runs on Supabase (database and realtime) and Vercel
              (hosting). Sentry receives automatic error reports, and Resend
              delivers problem reports by email. Since version 1.1, Google
              AdMob serves the ads in the app. Standard server logs may include
              IP addresses for security and operations. Capi gives these
              providers only the data they need to provide their service, and
              each of them protects it at least as well as this policy
              describes.
            </p>
          </Section>

          <Section title="Your choices">
            <p>You can change your mind at any time:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Tracking: on iOS, go to Settings &gt; Privacy &amp; Security
                &gt; Tracking and turn Capi off. From then on Google does not
                receive the advertising identifier.
              </li>
              <li>
                Ad consent: in regions where Google asks for consent, open the
                store in the app and tap &quot;Ad privacy options&quot; to
                change your choice.
              </li>
              <li>
                No ads: &quot;Remove Ads&quot; or &quot;Todo Capi&quot; turns
                the ads SDK off.
              </li>
            </ul>
          </Section>

          <Section title="Deleting your data">
            <p>
              There are no accounts, so your data is identified by the game
              code. To ask us to delete a game, your nickname in it, or a
              report you sent, email <Email /> with the game code and your
              nickname. We delete that data and confirm by email.
            </p>
          </Section>

          <Section title="What we don't do">
            <p>
              We never sell your data. There is no free-text chat between
              players. Apart from the in-app ads described above, there is no
              tracking and there are no analytics SDKs. Game data exists only
              to operate the game and may be deleted over time.
            </p>
          </Section>

          <Section title="Children">
            <p>
              The game is suitable for all ages and collects no more data from
              anyone than described here.
            </p>
          </Section>

          <Section title="Changes">
            <p>Any changes to this policy will be posted on this page.</p>
          </Section>

          <Section title="Contact">
            <p>
              Email <Email />.
            </p>
          </Section>
        </article>

        {/* Footer */}
        <footer className="flex items-center justify-center gap-3 text-xs font-medium text-gray-500">
          <Link href="/" className="hover:text-gray-800 transition-colors">
            Inicio / Home
          </Link>
          <span aria-hidden className="text-gray-300">
            ·
          </span>
          <Link
            href="/support"
            className="hover:text-gray-800 transition-colors"
          >
            Soporte / Support
          </Link>
        </footer>
      </div>
    </main>
  );
}
