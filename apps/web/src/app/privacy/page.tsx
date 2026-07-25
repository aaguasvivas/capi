import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad / Privacy",
  description:
    "Política de privacidad de Capi: sin cuentas, sin anuncios, sin rastreo. Capi privacy policy: no accounts, no ads, no tracking.",
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
              Vigente desde el 24 de julio de 2026 · Aplica a playcapi.com y a
              la app de Capi para iOS y Android
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

          <Section title="Reportes de errores">
            <p>
              Los reportes son opcionales. Si usas el botón de reportar un
              problema dentro del juego, el reporte incluye el estado actual de
              la partida y datos básicos del dispositivo (sistema operativo,
              tamaño de pantalla e idioma) para poder corregir el problema.
            </p>
          </Section>

          <Section title="Infraestructura">
            <p>
              Capi funciona sobre Supabase (base de datos y tiempo real) y
              Vercel (alojamiento). Los registros estándar del servidor pueden
              incluir direcciones IP por motivos de seguridad y operación.
            </p>
          </Section>

          <Section title="Lo que no hacemos">
            <p>
              No hay anuncios, ni SDKs de analítica, ni rastreo. No vendemos ni
              compartimos tus datos. Los datos de las partidas existen solo
              para operar el juego y pueden borrarse con el tiempo.
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
              Effective July 24, 2026 · Applies to playcapi.com and the Capi
              iOS and Android app
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

          <Section title="Bug reports">
            <p>
              Bug reports are optional. If you use the in-app bug report
              button, the report includes the current game state and basic
              device info (OS, screen size, language) so problems can be fixed.
            </p>
          </Section>

          <Section title="Infrastructure">
            <p>
              Capi runs on Supabase (database and realtime) and Vercel
              (hosting). Standard server logs may include IP addresses for
              security and operations.
            </p>
          </Section>

          <Section title="What we don't do">
            <p>
              No ads, no analytics SDKs, no tracking. We never sell or share
              your data. Game data exists only to operate the game and may be
              deleted over time.
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
