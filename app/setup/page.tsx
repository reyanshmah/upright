"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { AppShell, PinnedRow } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
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
      <PinnedRow back={() => router.push("/start?resume=1")} backLabel={t.back}>
        <button
          type="button"
          className={`btn ${allChecked ? "btn--primary" : "btn--notready"}`}
          aria-disabled={!allChecked}
          onClick={() => (allChecked ? setStep("method") : document.querySelector(".checklist input:not(:checked)")?.closest("label")?.focus())}
        >
          {t.next}
        </button>
      </PinnedRow>
    ) : step === "method" ? (
      <PinnedRow back={() => setStep("safety")} backLabel={t.back}>
        {null}
      </PinnedRow>
    ) : step === "tape" ? (
      <PinnedRow back={() => setStep("method")} backLabel={t.back}>
        <button type="button" className="btn btn--primary" onClick={() => finish("tape", null)}>
          {t.tapeDone}
        </button>
      </PinnedRow>
    ) : null;

  return (
    <AppShell lang={lang} onLang={onLang} pinned={pinned}>
      {step === "safety" && (
        <>
          <div className="stack-sm">
            <h1 className="h1">{t.safetyTitle}</h1>
            <p className="lead">{t.safetySub}</p>
          </div>
          <ul className="checklist">
            {items.map((text, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span className="checklist__box" aria-hidden>
                    <Icon name="check" size={22} />
                  </span>
                  <span>{text}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="footnote" aria-live="polite">
            <Icon name={allChecked ? "check" : "info"} size={20} />
            <span>{allChecked ? t.allChecked : `${t.safetyAll} (${checks.filter(Boolean).length}/5)`}</span>
          </p>
        </>
      )}

      {step === "method" && (
        <>
          <div className="stack-sm">
            <h1 className="h1">{t.measureTitle}</h1>
            <p className="lead">{t.measureSub}</p>
          </div>
          <SetupDiagram kind="measure" lang={lang} />
          <div className="action-list">
            <button type="button" className="action-card" onClick={() => setStep("tape")}>
              <span>{t.measureTape}</span>
              <Icon name="back" className="icon--flip" />
            </button>
            <button type="button" className="action-card" onClick={() => setStep("ar")}>
              <span>{t.measureCamera}</span>
              <Icon name="back" className="icon--flip" />
            </button>
          </div>
        </>
      )}

      {step === "tape" && (
        <>
          <div className="stack-sm">
            <h1 className="h1">{t.tapeTitle}</h1>
            <p className="lead">{t.tapeBody}</p>
          </div>
          <SetupDiagram kind="tug" lang={lang} />
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
