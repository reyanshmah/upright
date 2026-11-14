"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { loadSession, updateSession, type SessionState, type TugEntry } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";
import { TestRunner } from "@/components/TestRunner";
import { STRINGS } from "@/lib/i18n";
import { isIOS } from "@/lib/platform";

export default function TugPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSession(loadSession());
    setLoaded(true);
  }, []);
  if (!loaded) return null;
  if (!session) return <NeedStart />;
  const onLang = (l: Lang) => {
    setLangPref(l);
    updateSession({ lang: l });
    setSession({ ...session, lang: l });
  };
  return (
    <TestRunner
      kind="tug"
      lang={session.lang}
      onLang={onLang}
      age={session.profile.age}
      sex={session.profile.sex}
      onSaved={(r) => updateSession({ tug: r as TugEntry })}
      onSkip={(reason) => {
        updateSession({ tug: { skipped: true, reason } });
        router.push("/test/chair");
      }}
      onNext={() => router.push("/test/chair")}
      onBack={() => router.push("/setup")}
      introNote={session.setup?.lineMethod === "pose" && isIOS() ? STRINGS[session.lang].lineCheckReminder : undefined}
    />
  );
}
