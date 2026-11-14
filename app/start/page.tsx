"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { detectLang, setLangPref } from "@/lib/langPref";
import { AppShell, PinnedRow } from "@/components/AppShell";
import { ChoiceGroup, Field } from "@/components/Form";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { speakText } from "@/lib/voice";
import {
  loadSession,
  saveSession,
  screenedAtRisk,
  STEADI_MIN_AGE,
  type FallCount,
  type Screening,
  type WalkingAid,
} from "@/lib/session";
import { chairStandNorm, type Sex } from "@/lib/signal/thresholds";

/**
 * Onboarding, one topic per screen. There are always two people: the person
 * being checked and a helper who holds the phone, so the wording speaks to the
 * helper. It opens with what Upright does and how the data stays safe. The CDC
 * STEADI questions are shown word for word; the helper reads them out loud to
 * the person and taps the answer (that is how STEADI is given).
 */
type Step = "welcome" | "about" | "body" | "q1" | "q2" | "q3" | "summary";
const ORDER: Step[] = ["welcome", "about", "body", "q1", "q2", "q3", "summary"];
const COUNTED = 6; // steps before the summary

type YesNo = boolean | null;

export default function Start() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [firstName, setFirstName] = useState("");
  const [ageText, setAgeText] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [aid, setAid] = useState<WalkingAid | null>(null);
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
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
    // Back from Setup: reopen the summary with the saved answers instead of a blank form.
    const prev = new URLSearchParams(window.location.search).get("resume") ? loadSession() : null;
    if (prev) {
      setLang(prev.lang);
      setFirstName(prev.profile.firstName);
      setAgeText(String(prev.profile.age));
      setSex(prev.profile.sex);
      setAid(prev.profile.walkingAid);
      setUnsteady(prev.screening.unsteady);
      setWorry(prev.screening.worry);
      setFallen(prev.screening.fallen);
      setFallCount(prev.screening.fallCount);
      setInjured(prev.screening.injured);
      setStep("summary");
    }
  }, []);
  // New screen: start at the top, and hide errors until the person tries to continue.
  useEffect(() => {
    document.querySelector(".app__scroll")?.scrollTo({ top: 0 });
    setTouched(false);
  }, [step]);

  if (!lang) return null;
  const t = STRINGS[lang];
  const helper = true; // a helper always holds the phone
  const name = firstName.trim();
  const onLang = (l: Lang) => {
    setLangPref(l);
    setLang(l);
  };

  const age = Number(ageText);
  const ageValid = ageText !== "" && Number.isInteger(age) && age >= 18 && age <= 110;

  const stepOk: Record<Step, boolean> = {
    welcome: true,
    about: ageValid && sex !== null,
    body: aid !== null,
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
        runner: "helper",
        profile: { firstName: name, age, sex: sex!, walkingAid: aid! },
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
          <button type="button" className="linkish linkish--icon" onClick={() => speakText(lang, text)}>
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

      {step === "welcome" && (
        <section className="stack">
          <div className="stack-sm">
            <h1 className="h1">{t.welcomeTitle}</h1>
            <p className="lead">{t.welcomeLead}</p>
          </div>
          <ul className="info-cards">
            <li className="info-card info-card--info">
              <Icon name="clock" />
              <div>
                <h2 className="info-card__title">{t.welcomeWhatTitle}</h2>
                <p>{t.welcomeWhat}</p>
              </div>
            </li>
            <li className="info-card info-card--info">
              <Icon name="people" />
              <div>
                <h2 className="info-card__title">{t.welcomeWhoTitle}</h2>
                <p>{t.welcomeWho}</p>
              </div>
            </li>
            <li className="info-card info-card--ok">
              <Icon name="shield" />
              <div>
                <h2 className="info-card__title">{t.welcomeSafeTitle}</h2>
                <ul className="info-card__list">
                  {t.welcomeSafe.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </li>
            <li className="info-card info-card--warn">
              <Icon name="alert" />
              <div>
                <h2 className="info-card__title">{t.welcomeNotDxTitle}</h2>
                <p>{t.welcomeNotDx}</p>
              </div>
            </li>
          </ul>
          <p className="footnote">
            <Icon name="doc" size={20} />
            <span>
              {t.welcomeAgree} <Link href="/privacy">{t.privacyLink}</Link> {t.and} <Link href="/terms">{t.termsLink}</Link>.
            </span>
          </p>
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
          {fallen && injured && <p className="callout callout--error">{t.resultInjured}</p>}
          {fallen && fallCount !== null && fallCount !== "1" && <p className="callout callout--error">{t.resultTwoPlus}</p>}
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
