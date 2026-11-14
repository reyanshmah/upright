"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { detectLang, setLangPref } from "@/lib/langPref";
import type { LegalDoc } from "@/lib/legal";
import { AppShell } from "./AppShell";

/** Privacy Policy / Terms of Service: one heading per section so it never reads as a wall of text. */
export function LegalPage({ doc }: { doc: (lang: Lang) => LegalDoc }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => setLang(detectLang()), []);
  if (!lang) return null;
  const t = STRINGS[lang];
  const d = doc(lang);
  return (
    <AppShell
      lang={lang}
      onLang={(l) => {
        setLangPref(l);
        setLang(l);
      }}
      pinned={
        <button type="button" className="btn btn--secondary" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>
          {t.back}
        </button>
      }
    >
      <article className="legal stack">
        <header className="stack-sm">
          <h1 className="h1">{d.title}</h1>
          <p className="eyebrow">{d.effective}</p>
          <p className="lead">{d.intro}</p>
        </header>
        {d.sections.map((s) => (
          <section key={s.h} className="legal__section">
            <h2 className="h2">{s.h}</h2>
            {s.p?.map((x) => (
              <p key={x}>{x}</p>
            ))}
            {s.list && (
              <ul className="legal__list">
                {s.list.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </AppShell>
  );
}
