import type { Metadata } from "next";
import Link from "next/link";

// Static metadata carries one language (Spanish, the document default); the
// page body below serves both languages in their own lang-tagged sections.
export const metadata: Metadata = {
  title: "Soporte",
  description: "Ayuda con Capi, el dominó dominicano en línea.",
};

const GOLD = "#b8860b";

function LangTag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.18em] text-white">
      {children}
    </span>
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

export default function SupportPage() {
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
            Soporte · Support
          </p>
        </header>

        {/* Español */}
        <article
          lang="es"
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-4"
        >
          <div className="space-y-2">
            <LangTag>ES</LangTag>
            <h2 className="text-xl font-black tracking-tight text-gray-900">
              Soporte
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Capi es un juego de dominó dominicano en línea, 1v1 o 2v2, sin
              cuenta y gratis.
            </p>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-gray-600">
            <h3 className="text-sm font-bold text-gray-900">
              ¿Necesitas ayuda?
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Lo más rápido es el botón de reportar un problema dentro del
                juego. Envía el estado de la partida para poder reproducirlo.
              </li>
              <li>
                También puedes escribir a <Email />. Si tienes un código de
                partida, inclúyelo en el mensaje.
              </li>
            </ul>
          </div>
        </article>

        {/* English */}
        <article
          lang="en"
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-4"
        >
          <div className="space-y-2">
            <LangTag>EN</LangTag>
            <h2 className="text-xl font-black tracking-tight text-gray-900">
              Support
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Capi is an online Dominican dominoes game, 1v1 or 2v2, free and
              with no account.
            </p>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-gray-600">
            <h3 className="text-sm font-bold text-gray-900">Need help?</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                The fastest way is the bug report button inside the game. It
                sends the game state along so the problem can be reproduced.
              </li>
              <li>
                You can also email <Email />. If you have a game code, include
                it in your message.
              </li>
            </ul>
          </div>
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
            href="/privacy"
            className="hover:text-gray-800 transition-colors"
          >
            Privacidad / Privacy
          </Link>
        </footer>
      </div>
    </main>
  );
}
