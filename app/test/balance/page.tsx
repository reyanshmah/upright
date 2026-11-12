"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { loadSession, tugVerySlow, updateSession, type SessionState } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";
import { BalanceRunner } from "@/components/BalanceRunner";

export default function BalancePage() {
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

  // Plan: no balance test for anyone who struggled with the TUG.
  if (verySlow && !override) {
    const skip = () => {
      updateSession({ balance: { skipped: true, reason: "TUG took 20 s or more (safety)" } });
      router.push("/results");
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
        <p className="eyebrow">{t.testOf(3)}</p>
        <h1 className="h1">{t.balName}</h1>
        <StatusBadge kind="risk">{t.balSkipSlow}</StatusBadge>
        <button type="button" className="btn btn--secondary" onClick={() => setOverride(true)}>
          {t.doAnyway}
        </button>
      </AppShell>
    );
  }

  return (
    <BalanceRunner
      lang={session.lang}
      onLang={onLang}
      onSaved={(r) => updateSession({ balance: r })}
      onSkip={(reason) => {
        updateSession({ balance: { skipped: true, reason } });
        router.push("/results");
      }}
      onNext={() => router.push("/results")}
      onBack={() => router.push("/test/chair")}
    />
  );
}
