"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { loadSession, tugVerySlow, updateSession, type ChairEntry, type SessionState } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";
import { TestRunner } from "@/components/TestRunner";

export default function ChairPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [override, setOverride] = useState(false);
  useEffect(() => {
    setSession(loadSession());
    setLoaded(true);
  }, []);
  if (!loaded) return null;
  if (!session) return <NeedStart />;
  const t = STRINGS[session.lang];
  const verySlow = tugVerySlow(session.tug);
  const onLang = (l: Lang) => {
    setLangPref(l);
    updateSession({ lang: l });
    setSession({ ...session, lang: l });
  };

  // Safety: a very slow TUG (>= 20 s) suggests skipping the chair stand.
  if (verySlow && !override) {
    const skip = () => {
      updateSession({ chair: { skipped: true, reason: "TUG took 20 s or more (safety)" } });
      router.push("/test/balance");
    };
    return (
      <AppShell
        lang={session.lang}
        onLang={onLang}
        pinned={
          <button type="button" className="btn btn--primary" onClick={skip}>
            {t.skipTest}
          </button>
        }
      >
        <p className="eyebrow">{t.testOf(2)}</p>
        <h1 className="h1">{t.chairName}</h1>
        <StatusBadge kind="total">{t.slowSkipNote}</StatusBadge>
        <button type="button" className="btn btn--secondary" onClick={() => setOverride(true)}>
          {t.doAnyway}
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => router.push("/test/tug")}>
          {t.back}
        </button>
      </AppShell>
    );
  }

  return (
    <TestRunner
      kind="chair"
      lang={session.lang}
      onLang={onLang}
      age={session.profile.age}
      sex={session.profile.sex}
      onSaved={(r) => updateSession({ chair: r as ChairEntry })}
      onSkip={(reason) => {
        updateSession({ chair: { skipped: true, reason } });
        router.push("/test/balance");
      }}
      onNext={() => router.push("/test/balance")}
      onBack={() => router.push("/test/tug")}
    />
  );
}
