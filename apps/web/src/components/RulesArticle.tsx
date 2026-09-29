import type { Lang, RulesContent } from "@capi/i18n";

// The rules in one language: the /rules page shows both, tagged by
// language, and the table's "How to play" sheet shows the player's own.

function LangTag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.18em] text-white">
      {children}
    </span>
  );
}

export default function RulesArticle({
  lang,
  rules,
  tagged = true,
}: {
  lang: Lang;
  rules: RulesContent;
  tagged?: boolean;
}) {
  return (
    <article
      lang={lang}
      className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 p-6 sm:p-8 space-y-5"
    >
      <div className="space-y-2">
        {tagged && <LangTag>{lang.toUpperCase()}</LangTag>}
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
