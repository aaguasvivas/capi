import type { Metadata } from "next";
import Link from "next/link";
import { RULES, type Lang, type RulesContent } from "@capi/i18n";

// Static metadata carries one language (Spanish, the document default); the
// page body below serves both languages in their own lang-tagged sections.
export const metadata: Metadata = {
  title: RULES.es.title,
  description:
    "Las reglas del dominó dominicano tal como se juegan en Capi: dominó, capicúa, tranque y pase corrido.",
};

const GOLD = "#b8860b";

function LangTag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.18em] text-white">
      {children}
    </span>
  );
}

function RulesArticle({ lang, rules }: { lang: Lang; rules: RulesContent }) {
  return (
    <article
      lang={lang}
      className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-5"
    >
      <div className="space-y-2">
        <LangTag>{lang.toUpperCase()}</LangTag>
        <h2 className="text-xl font-black tracking-tight text-gray-900">
          {rules.title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">{rules.intro}</p>
      </div>

      {rules.sections.map((section) => (
        <section key={section.title} className="space-y-1.5">
          <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed text-gray-600">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

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
