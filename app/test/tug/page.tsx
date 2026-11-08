"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS } from "@/lib/i18n";
import { loadSession, updateSession, type SessionState, type TugResult } from "@/lib/session";
import { TestRunner } from "@/components/TestRunner";

export default function TugPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
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
  return (
    <main lang={session.lang}>
      <TestRunner
        kind="tug"
        lang={session.lang}
        age={session.profile.age}
        sex={session.profile.sex}
        onSaved={(r) => updateSession({ tug: r as TugResult })}
        onSkip={(reason) => {
          updateSession({ tug: { skipped: true, reason } });
          router.push("/test/chair");
        }}
        onNext={() => router.push("/test/chair")}
      />
      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
