import type { Metadata } from "next";
import Link from "next/link";
import { RULES } from "@capi/i18n";
import RulesArticle from "@/components/RulesArticle";

// Static metadata carries one language (Spanish, the document default); the
// page body below serves both languages in their own lang-tagged sections.
export const metadata: Metadata = {
  title: RULES.es.title,
  description:
    "Las reglas del dominó dominicano tal como se juegan en Capi: dominó, capicúa, tranque y pase corrido.",
};

const GOLD = "#b8860b";

export default function RulesPage() {
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
            {RULES.es.title} · {RULES.en.title}
          </p>
        </header>

        <RulesArticle lang="es" rules={RULES.es} />
        <RulesArticle lang="en" rules={RULES.en} />

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500">
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
