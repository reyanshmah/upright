"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STRINGS, type Lang } from "@/lib/i18n";
import { getLangPref, setLangPref } from "@/lib/langPref";
import { AppShell } from "@/components/AppShell";

/** Shown when a page opens with no session: uses the device language if one was chosen, else both. */
export function NeedStart({ what = "start" }: { what?: "start" | "results" }) {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => setLang(getLangPref()), []);
  const msg = (l: Lang) => (what === "results" ? STRINGS[l].needResults : STRINGS[l].needStart);
  const langs: Lang[] = lang ? [lang] : ["en", "es"];
  return (
    <AppShell
      lang={lang}
      onLang={(l) => {
        setLangPref(l);
        setLang(l);
      }}
      pinned={
        <Link className="btn btn--primary" href="/start">
          {lang ? STRINGS[lang].startBtn : `${STRINGS.en.startBtn} · ${STRINGS.es.startBtn}`}
        </Link>
      }
    >
      <h1 className="h1">Upright</h1>
      {langs.map((l) => (
        <p key={l} lang={l}>
          {msg(l)}
        </p>
      ))}
    </AppShell>
  );
}
