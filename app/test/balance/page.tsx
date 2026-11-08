"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS } from "@/lib/i18n";
import { isSkipped, loadSession, updateSession, type SessionState } from "@/lib/session";
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
  if (!loaded) return <main />;
  if (!session) {
    return (
      <main>
        <p>Start with the screening questions first.</p>
        <Link className="btn" href="/start">Start</Link>
      </main>
    );
  }
  const t = STRINGS[session.lang];
  const verySlow = !!session.tug && !isSkipped(session.tug) && !!session.tug.verySlow;

  // Plan: no balance test for anyone who struggled with the TUG.
  if (verySlow && !override) {
    return (
      <main lang={session.lang}>
        <p className="eyebrow">{t.testOf(3)}</p>
        <h1>{t.balName}</h1>
        <div className="card warn"><p>{t.balSkipSlow}</p></div>
        <div className="choices">
          <button
            className="choice selected"
            onClick={() => {
              updateSession({ balance: { skipped: true, reason: "TUG took 20 s or more (safety)" } });
              router.push("/results");
            }}
          >
            {t.skipTest} → {t.seeResults}
          </button>
          <button className="choice" onClick={() => setOverride(true)}>{t.doAnyway}</button>
        </div>
        <p className="disclaimer">{t.disclaimer}</p>
      </main>
    );
  }

  return (
    <main lang={session.lang}>
      <BalanceRunner
        lang={session.lang}
        onSaved={(r) => updateSession({ balance: r })}
        onSkip={(reason) => {
          updateSession({ balance: { skipped: true, reason } });
          router.push("/results");
        }}
        onNext={() => router.push("/results")}
      />
      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
