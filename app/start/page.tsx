"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { detectLang, setLangPref } from "@/lib/langPref";
import { AppShell, PinnedRow } from "@/components/AppShell";
import { ChoiceGroup, Field } from "@/components/Form";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import {
  saveSession,
  screenedAtRisk,
  STEADI_MIN_AGE,
  type FallCount,
  type Runner,
  type Screening,
  type WalkingAid,
} from "@/lib/session";
import { chairStandNorm, type Sex } from "@/lib/signal/thresholds";

/**
 * Onboarding, one topic per screen. The wording follows who is holding the
 * phone: "you" for someone testing themselves, "they" for a helper. The CDC
 * STEADI questions are always shown word for word; a helper is asked to read
 * them out loud to the person and tap the answer (that is how STEADI is given).
 */
type Step = "who" | "about" | "body" | "q1" | "q2" | "q3" | "summary";
const ORDER: Step[] = ["who", "about", "body", "q1", "q2", "q3", "summary"];
const COUNTED = 6; // steps before the summary

type YesNo = boolean | null;

function speak(text: string, lang: Lang) {
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "es" ? "es-US" : "en-US";
    u.rate = 0.9;
    s.speak(u);
  } catch {
    /* no speech on this browser */
  }
}

export default function Start() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang | null>(null);
  const [step, setStep] = useState<Step>("who");
  const [runner, setRunner] = useState<Runner | null>(null);
  const [firstName, setFirstName] = useState("");
  const [ageText, setAgeText] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [aid, setAid] = useState<WalkingAid | null>(null);
  const [heightUnit, setHeightUnit] = useState<"imperial" | "metric">("imperial");
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [cmText, setCmText] = useState("");
  const [unsteady, setUnsteady] = useState<YesNo>(null);
  const [worry, setWorry] = useState<YesNo>(null);
  const [fallen, setFallen] = useState<YesNo>(null);
  const [fallCount, setFallCount] = useState<FallCount | null>(null);
  const [injured, setInjured] = useState<YesNo>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const l = detectLang();
    setLang(l);
    setHeightUnit(l === "es" ? "metric" : "imperial");
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);
  // New screen: start at the top, and hide errors until the person tries to continue.
  useEffect(() => {
    document.querySelector(".app__scroll")?.scrollTo({ top: 0 });
    setTouched(false);
  }, [step]);

  if (!lang) return null;
  const t = STRINGS[lang];
  const helper = runner === "helper";
  const name = firstName.trim();
  const onLang = (l: Lang) => {
    setLangPref(l);
    setLang(l);
  };

  const age = Number(ageText);
  const ageValid = ageText !== "" && Number.isInteger(age) && age >= 18 && age <= 110;
  const heightCm =
    heightUnit === "metric" ? Number(cmText) : (Number(ft || 0) * 12 + Number(inch || 0)) * 2.54;
  const heightEntered = heightUnit === "metric" ? cmText !== "" : ft !== "";
  const heightValid = heightEntered && heightCm >= 120 && heightCm <= 215;

  const stepOk: Record<Step, boolean> = {
    who: runner !== null,
    about: ageValid && sex !== null,
    body: heightValid && aid !== null,
    q1: unsteady !== null,
    q2: worry !== null,
    q3: fallen !== null && (fallen === false || (fallCount !== null && injured !== null)),
    summary: true,
  };

  const idx = ORDER.indexOf(step);
  const goBack = () => (idx === 0 ? router.push("/") : setStep(ORDER[idx - 1]));
  const goNext = () => {
    if (!stepOk[step]) {
      setTouched(true);
      return;
    }
    if (step === "q3") {
      const screening: Screening = {
        unsteady: unsteady!,
        worry: worry!,
        fallen: fallen!,
        fallCount: fallen ? fallCount : null,
        injured: fallen ? injured : null,
      };
      saveSession({
        lang,
        runner: runner!,
        profile: { firstName: name, age, sex: sex!, walkingAid: aid!, heightCm: Math.round(heightCm) },
        screening,
        createdAt: new Date().toISOString(),
      });
    }
    if (step === "summary") router.push("/setup");
    else setStep(ORDER[idx + 1]);
  };

  const yesNo = [
    { v: true, label: t.yes },
    { v: false, label: t.no },
  ];
  const atRisk = screenedAtRisk({ unsteady: !!unsteady, worry: !!worry, fallen: !!fallen, fallCount, injured });

  /** A STEADI question screen: "Ask Maria:" for helpers, the exact CDC wording, read-aloud. */
  const question = (n: 1 | 2 | 3, text: string, value: YesNo, set: (v: boolean) => void, extra?: React.ReactNode) => (
    <section className="stack">
      <div className="ask-row">
        {helper ? <p className="ask">{name ? t.askName(name) : t.askThem}</p> : <span />}
        {canSpeak && (
          <button type="button" className="linkish linkish--icon" onClick={() => speak(text, lang)}>
            <Icon name="speaker" />
            <span>{t.readAloud}</span>
          </button>
        )}
      </div>
      <ChoiceGroup legend={text} legendClass="h1 question" value={value} onChange={set} options={yesNo} layout="row" />
      {extra}
      {helper && (
        <p className="footnote">
          <Icon name="info" size={20} />
          <span>{t.helperAskNote}</span>
        </p>
      )}
      {touched && !stepOk[step] && <p className="field-error" role="alert">{t.fixItems}</p>}
    </section>
  );

  const pinned = (
    <PinnedRow back={goBack} backLabel={t.back}>
      <button
        type="button"
        className={`btn ${stepOk[step] ? "btn--primary" : "btn--notready"}`}
        aria-disabled={!stepOk[step]}
        onClick={goNext}
      >
        {step === "summary" ? t.continueTests : t.next}
      </button>
    </PinnedRow>
  );

  return (
    <AppShell lang={lang} onLang={onLang} pinned={pinned}>
      {step !== "summary" && (
        <div className="progress">
          <span className="progress__label">
            {step.startsWith("q") ? t.questionOf(Number(step[1])) : t.stepOf(idx + 1, COUNTED)}
          </span>
          <span className="progress__track" aria-hidden>
            <span className="progress__fill" style={{ width: `${((idx + 1) / COUNTED) * 100}%` }} />
          </span>
        </div>
      )}

      {step === "who" && (
        <section className="stack">
          <ChoiceGroup
            legend={t.whoTitle}
            legendClass="h1"
            value={runner}
            onChange={setRunner}
            options={[
              { v: "helper", label: t.whoHelper },
              { v: "self", label: t.whoSelf },
            ]}
          />
          {runner && (
            <p className="footnote">
              <Icon name="info" size={20} />
              <span>{helper ? t.whoHelperNote : t.whoSelfNote}</span>
            </p>
          )}
          {touched && !runner && <p className="field-error" role="alert">{t.fixItems}</p>}
        </section>
      )}

      {step === "about" && (
        <section className="stack">
          <div className="stack-sm">
            <h1 className="h1">{helper ? t.aboutTitleHelper : t.aboutTitleSelf}</h1>
            <p className="muted">{t.aboutSub}</p>
          </div>
          <Field label={helper ? t.nameLabelHelper : t.nameLabelSelf} optional={t.optional} hint={t.nameHint}>
            {({ id, describedBy }) => (
              <input
                id={id}
                className="input"
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                maxLength={40}
                placeholder={t.namePlaceholder}
                aria-describedby={describedBy}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={helper ? t.ageLabelHelper : t.ageLabelSelf}
            error={(ageText !== "" || touched) && !ageValid ? t.ageInvalid : undefined}
            hint={ageValid && age < STEADI_MIN_AGE ? t.ageUnder65 : undefined}
          >
            {({ id, describedBy }) => (
              <span className="input-unit">
                <input
                  id={id}
                  className="input input--short"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-describedby={describedBy}
                  aria-invalid={(ageText !== "" || touched) && !ageValid}
                  value={ageText}
                  onChange={(e) => setAgeText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
                <span className="input-unit__suffix">{t.years}</span>
              </span>
            )}
          </Field>
          <ChoiceGroup
            legend={t.sexLabel}
            hint={t.sexHint}
            value={sex}
            onChange={setSex}
            layout="row"
            options={[
              { v: "female", label: t.female },
              { v: "male", label: t.male },
            ]}
          />
          {touched && sex === null && <p className="field-error" role="alert">{t.fixItems}</p>}
        </section>
      )}

      {step === "body" && (
        <section className="stack">
          <h1 className="h1">{t.bodyTitle}</h1>
          <fieldset className="choice-group">
            <legend className="label">{t.heightLabel}</legend>
            <p className="hint">{t.heightHint}</p>
            <div className="segmented" role="group" aria-label={t.heightLabel}>
              <button type="button" aria-pressed={heightUnit === "imperial"} onClick={() => setHeightUnit("imperial")}>
                {t.feet} + {t.inches}
              </button>
              <button type="button" aria-pressed={heightUnit === "metric"} onClick={() => setHeightUnit("metric")}>
                {t.cm}
              </button>
            </div>
            <div className="input-row">
              {heightUnit === "imperial" ? (
                <>
                  <span className="input-unit">
                    <input
                      className="input input--short"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`${t.heightLabel}, ${t.feet}`}
                      value={ft}
                      onChange={(e) => setFt(e.target.value.replace(/\D/g, "").slice(0, 1))}
                    />
                    <span className="input-unit__suffix">{t.feet}</span>
                  </span>
                  <span className="input-unit">
                    <input
                      className="input input--short"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`${t.heightLabel}, ${t.inches}`}
                      value={inch}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setInch(v === "" ? "" : String(Math.min(11, Number(v))));
                      }}
                    />
                    <span className="input-unit__suffix">{t.inches}</span>
                  </span>
                </>
              ) : (
                <span className="input-unit">
                  <input
                    className="input input--short"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`${t.heightLabel}, ${t.cm}`}
                    value={cmText}
                    onChange={(e) => setCmText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                  <span className="input-unit__suffix">{t.cm}</span>
                </span>
              )}
            </div>
            {(heightEntered || touched) && !heightValid && (
              <p className="field-error" role="alert">
                {t.heightInvalid}
              </p>
            )}
          </fieldset>
          <ChoiceGroup
            legend={helper ? t.aidLabel : t.aidLabelSelf}
            value={aid}
            onChange={setAid}
            layout="grid"
            options={[
              { v: "none", label: t.aidNone },
              { v: "cane", label: t.aidCane },
              { v: "walker", label: t.aidWalker },
              { v: "other", label: t.aidOther },
            ]}
          />
          {aid && aid !== "none" && (
            <p className="footnote">
              <Icon name="info" size={20} />
              <span>{t.aidNote}</span>
            </p>
          )}
          {touched && aid === null && <p className="field-error" role="alert">{t.fixItems}</p>}
        </section>
      )}

      {step === "q1" && question(1, t.qUnsteady, unsteady, setUnsteady)}
      {step === "q2" && question(2, t.qWorry, worry, setWorry)}
      {step === "q3" &&
        question(
          3,
          t.qFallen,
          fallen,
          (v) => {
            setFallen(v);
            if (!v) {
              setFallCount(null);
              setInjured(null);
            }
          },
          fallen ? (
            <div className="followup stack">
              <ChoiceGroup
                legend={t.qHowMany}
                legendClass="label label--lg"
                value={fallCount}
                onChange={setFallCount}
                layout="row"
                options={[
                  { v: "1", label: t.timesOne },
                  { v: "2", label: t.timesTwo },
                  { v: "3+", label: t.timesMore },
                ]}
              />
              <ChoiceGroup
                legend={t.qInjured}
                legendClass="label label--lg"
                value={injured}
                onChange={setInjured}
                layout="row"
                options={yesNo}
              />
            </div>
          ) : null,
        )}

      {step === "summary" && (
        <section className="stack">
          <h1 className="h1">{name ? t.summaryTitleNamed(name) : t.summaryTitle}</h1>
          <StatusBadge kind={atRisk ? "risk" : "ok"}>{atRisk ? t.summaryRisk : t.summaryOk}</StatusBadge>
          <p className="lead">{atRisk ? t.resultBodyRisk : t.resultBodyBaseline}</p>
          {fallen && injured && <p className="callout">{t.resultInjured}</p>}
          {fallen && fallCount !== null && fallCount !== "1" && <p className="callout">{t.resultTwoPlus}</p>}
          {chairStandNorm(age, sex ?? "female") === null && (
            <p className="footnote">
              <Icon name="info" size={20} />
              <span>
                {lang === "en"
                  ? "The CDC chair-stand table covers ages 60 to 94, so that test will be shown without a comparison."
                  : "La tabla de los CDC para levantarse de la silla cubre de 60 a 94 años, así que esa prueba se mostrará sin comparación."}
              </span>
            </p>
          )}
          <p className="footnote">
            <Icon name="clock" size={20} />
            <span>{t.summaryNext}</span>
          </p>
        </section>
      )}
    </AppShell>
  );
}
