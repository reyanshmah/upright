"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STRINGS, type Lang } from "@/lib/i18n";
import { detectLang, setLangPref } from "@/lib/langPref";
import { AppShell } from "@/components/AppShell";

/** Shown when a page opens with no session, in the device language. */
export function NeedStart({ what = "start" }: { what?: "start" | "results" }) {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => setLang(detectLang()), []);
  if (!lang) return null;
  const t = STRINGS[lang];
  return (
    <AppShell
      lang={lang}
      onLang={(l) => {
        setLangPref(l);
        setLang(l);
      }}
      pinned={
        <Link className="btn btn--primary" href="/start">
          {t.startBtn}
        </Link>
      }
    >
      <h1 className="h1">{what === "results" ? t.needResults : t.needStart}</h1>
    </AppShell>
  );
}
