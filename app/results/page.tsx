"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { ResultsView } from "@/components/ResultsView";
import { clearSession, loadSession, updateSession, type SessionState } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";

export default function Results() {
  const router = useRouter();
  const [s, setS] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setS(loadSession());
    setLoaded(true);
  }, []);
  if (!loaded) return null;
  if (!s) return <NeedStart what="results" />;

  return (
    <ResultsView
      s={s}
      onLang={(l: Lang) => {
        setLangPref(l);
        updateSession({ lang: l });
        setS({ ...s, lang: l });
      }}
      onRedoTug={() => router.push("/test/tug")}
      onNewScreen={() => {
        clearSession();
        router.push("/start");
      }}
    />
  );
}
