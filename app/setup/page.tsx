"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS } from "@/lib/i18n";
import { loadSession, updateSession, type SessionState } from "@/lib/session";
import { SetupDiagram } from "@/components/Diagram";
import { ARMeasure } from "@/components/ARMeasure";

type Step = "safety" | "method" | "tape" | "ar";

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

  if (!loaded) return <main />;
  if (!session) {
    return (
      <main>
        <h1>Upright</h1>
        <p>Start with the screening questions first.</p>
        <Link className="btn" href="/start">Start</Link>
      </main>
    );
  }

  const lang = session.lang;
  const t = STRINGS[lang];
  const items = [t.safetyChair, t.safetyFloor, t.safetyShoes, t.safetyHelper, t.safetyStop];

  const finish = (method: "ar" | "tape", measured: number | null) => {
    updateSession({ setup: { safetyConfirmed: true, lineMethod: method, cameraMeasuredM: measured } });
    router.push("/test/tug");
  };

  return (
    <main lang={lang}>
      {step === "safety" && (
        <section>
          <h1>{t.safetyTitle}</h1>
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
          {!checks.every(Boolean) && <p className="muted">{t.safetyAll}</p>}
          <div className="row nav">
            <Link className="btn secondary" href="/start">{t.back}</Link>
            <button className="btn" disabled={!checks.every(Boolean)} onClick={() => setStep("method")}>
              {t.next}
            </button>
          </div>
        </section>
      )}

      {step === "method" && (
        <section>
          <h1>{t.measureTitle}</h1>
          <p>{t.measureSub}</p>
          <SetupDiagram kind="measure" />
          <div className="choices">
            <button className="choice" onClick={() => setStep("ar")}>
              📱 {t.measureCamera}
            </button>
            <button className="choice" onClick={() => setStep("tape")}>
              📏 {t.measureTape}
            </button>
          </div>
          <div className="row nav">
            <button className="btn secondary" onClick={() => setStep("safety")}>{t.back}</button>
          </div>
        </section>
      )}

      {step === "tape" && (
        <section>
          <h1>{t.tapeTitle}</h1>
          <p>{t.tapeBody}</p>
          <SetupDiagram kind="tug" />
          <div className="row nav">
            <button className="btn secondary" onClick={() => setStep("method")}>{t.back}</button>
            <button className="btn" onClick={() => finish("tape", null)}>{t.tapeDone}</button>
          </div>
        </section>
      )}

      {step === "ar" && (
        <>
          <h1>{t.measureTitle}</h1>
          <ARMeasure lang={lang} onBack={() => setStep("method")} onDone={(m) => finish("ar", m)} />
        </>
      )}

      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
