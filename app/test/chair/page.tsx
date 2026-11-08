"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS } from "@/lib/i18n";
import { isSkipped, loadSession, updateSession, type ChairResult, type SessionState } from "@/lib/session";
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

  // Safety: a very slow TUG (>= 20 s) suggests skipping the chair stand.
  if (verySlow && !override) {
    return (
      <main lang={session.lang}>
        <p className="eyebrow">{t.testOf(2)}</p>
        <h1>{t.chairName}</h1>
        <div className="card warn"><p>{t.slowSkipNote}</p></div>
        <div className="choices">
          <button
            className="choice selected"
            onClick={() => {
              updateSession({ chair: { skipped: true, reason: "TUG took 20 s or more (safety)" } });
              router.push("/results");
            }}
          >
            {t.skipTest} → {t.seeResults}
          </button>
          <button className="choice" onClick={() => setOverride(true)}>{t.doAnyway}</button>
        </div>
        <div className="row nav">
          <Link className="btn secondary" href="/test/tug">{t.back}</Link>
        </div>
        <p className="disclaimer">{t.disclaimer}</p>
      </main>
    );
  }

  return (
    <main lang={session.lang}>
      <TestRunner
        kind="chair"
        lang={session.lang}
        age={session.profile.age}
        sex={session.profile.sex}
        onSaved={(r) => updateSession({ chair: r as ChairResult })}
        onSkip={(reason) => {
          updateSession({ chair: { skipped: true, reason } });
          router.push("/results");
        }}
        onNext={() => router.push("/results")}
      />
      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
