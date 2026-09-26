import Link from "next/link";
import { en, es } from "@capi/i18n";

const GOLD = "#b8860b";

// Unknown paths. The document ships in Spanish before the client picks a
// language, so the page carries both, Spanish first, like the privacy and
// support pages.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f0e8] via-[#f0ebe3] to-[#e8d5c0] px-4 py-10 sm:py-14 flex items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 text-center">
        <header className="space-y-2">
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
            404
          </p>
        </header>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-5">
          <h1 className="space-y-1">
            <span
              lang="es"
              className="block text-xl font-black tracking-tight text-gray-900"
            >
              {es.notFoundTitle}
            </span>
            <span
              lang="en"
              className="block text-base font-semibold text-gray-600"
            >
              {en.notFoundTitle}
            </span>
          </h1>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gray-900 px-5 text-sm font-bold text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            <span lang="es">{es.backToHome}</span>
            <span aria-hidden className="px-1.5 opacity-60">
              /
            </span>
            <span lang="en">{en.backToHome}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
