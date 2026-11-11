"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { getLangPref, setLangPref } from "@/lib/langPref";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => setLang(getLangPref()), []);
  return (
    <AppShell
      lang={lang}
      onLang={(l) => {
        setLangPref(l);
        setLang(l);
      }}
      pinned={
        <Link className="btn btn--primary" href="/start">
          Start a screening · Empezar
        </Link>
      }
    >
      <h1 className="h1">Upright</h1>
      <p lang="en">
        A 10-minute home fall-risk screen using CDC STEADI tests: Timed Up and Go and the
        30-Second Chair Stand. Your phone does the measuring. No video leaves the phone.
      </p>
      <p className="muted" lang="es">Una evaluación en casa del riesgo de caídas, en inglés o español.</p>
      <p className="small">
        <Link href="/pose" className="muted">Developer: camera check</Link>
      </p>
    </AppShell>
  );
}
