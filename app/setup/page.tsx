"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { AppShell } from "@/components/AppShell";
import { loadSession, updateSession, type SessionState } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";
import { SetupDiagram } from "@/components/Diagram";
import { ARMeasure } from "@/components/ARMeasure";

type Step = "safety" | "method" | "tape" | "ar";

/** Safety checklist and the 3 m line. (The camera gate check is the first screen of each test.) */
export default function Setup() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<Step>("safety");
  const [checks, setChecks] = useState([false, false, false, false, false]);

  useEffect(() => {
    setSession(loadSession());
    setLoaded(true);
  }, []);

  if (!loaded) return null;
  if (!session) return <NeedStart />;

  const lang = session.lang;
  const t = STRINGS[lang];
  const items = [t.safetyChair, t.safetyFloor, t.safetyShoes, t.safetyHelper, t.safetyStop];
  const allChecked = checks.every(Boolean);
  const onLang = (l: Lang) => {
    setLangPref(l);
    updateSession({ lang: l });
    setSession({ ...session, lang: l });
  };

  const finish = (method: "ar" | "tape", measured: number | null) => {
    updateSession({ setup: { safetyConfirmed: true, lineMethod: method, cameraMeasuredM: measured } });
    router.push("/test/tug");
  };

  const pinned =
    step === "safety" ? (
      <button type="button" className="btn btn--primary" disabled={!allChecked} onClick={() => setStep("method")}>
        {t.next}
      </button>
    ) : step === "tape" ? (
      <button type="button" className="btn btn--primary" onClick={() => finish("tape", null)}>
        {t.tapeDone}
      </button>
    ) : null;

  return (
    <AppShell lang={lang} onLang={onLang} pinned={pinned}>
      {step === "safety" && (
        <>
          <h1 className="h1">{t.safetyTitle}</h1>
          <p className="muted">{t.safetySub}</p>
          <ul className="checklist">
            {items.map((text, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span>{text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!allChecked && <p className="muted">{t.safetyAll}</p>}
          <button type="button" className="btn btn--secondary" onClick={() => router.push("/start")}>
            {t.back}
          </button>
        </>
      )}

      {step === "method" && (
        <>
          <h1 className="h1">{t.measureTitle}</h1>
          <p>{t.measureSub}</p>
          <SetupDiagram kind="measure" />
          <div className="choices">
            <button type="button" className="choice" onClick={() => setStep("ar")}>
              {t.measureCamera}
            </button>
            <button type="button" className="choice" onClick={() => setStep("tape")}>
              {t.measureTape}
            </button>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => setStep("safety")}>
            {t.back}
          </button>
        </>
      )}

      {step === "tape" && (
        <>
          <h1 className="h1">{t.tapeTitle}</h1>
          <p>{t.tapeBody}</p>
          <SetupDiagram kind="tug" />
          <button type="button" className="btn btn--secondary" onClick={() => setStep("method")}>
            {t.back}
          </button>
        </>
      )}

      {step === "ar" && (
        <>
          <h1 className="h1">{t.measureTitle}</h1>
          <ARMeasure lang={lang} onBack={() => setStep("method")} onDone={(m) => finish("ar", m)} />
        </>
      )}
    </AppShell>
  );
}
