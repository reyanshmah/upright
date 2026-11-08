"use client";

import { useState } from "react";
import Link from "next/link";
import { STRINGS, type Lang } from "@/lib/i18n";
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

type Step = "lang" | "who" | "profile" | "screen" | "result";
const ORDER: Step[] = ["lang", "who", "profile", "screen", "result"];

type YesNo = boolean | null;

function Choice<T extends string | boolean>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`choice ${value === o.v ? "selected" : ""}`}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Start() {
  const [step, setStep] = useState<Step>("lang");
  const [lang, setLang] = useState<Lang>("en");
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

  const t = STRINGS[lang];
  const yesNo = [
    { v: true, label: t.yes },
    { v: false, label: t.no },
  ];

  const age = Number(ageText);
  const ageValid = ageText !== "" && Number.isInteger(age) && age >= 18 && age <= 110;
  const heightCm =
    heightUnit === "metric"
      ? Number(cmText)
      : (Number(ft || 0) * 12 + Number(inch || 0)) * 2.54;
  const heightEntered = heightUnit === "metric" ? cmText !== "" : ft !== "";
  const heightValid = heightEntered && heightCm >= 120 && heightCm <= 215;
  const profileDone = ageValid && sex !== null && aid !== null && heightValid;
  const screenDone =
    unsteady !== null &&
    worry !== null &&
    fallen !== null &&
    (fallen === false || (fallCount !== null && injured !== null));

  const go = (dir: 1 | -1) => setStep(ORDER[ORDER.indexOf(step) + dir]);

  const finishScreening = () => {
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
      profile: {
        firstName: firstName.trim(),
        age,
        sex: sex!,
        walkingAid: aid!,
        heightCm: Math.round(heightCm),
      },
      screening,
      createdAt: new Date().toISOString(),
    });
    setStep("result");
  };

  const reset = () => {
    setRunner(null);
    setFirstName("");
    setAgeText("");
    setSex(null);
    setAid(null);
    setFt("");
    setInch("");
    setCmText("");
    setUnsteady(null);
    setWorry(null);
    setFallen(null);
    setFallCount(null);
    setInjured(null);
    setStep("lang");
  };

  const progress = ORDER.indexOf(step);
  const atRisk = screenedAtRisk({
    unsteady: !!unsteady,
    worry: !!worry,
    fallen: !!fallen,
    fallCount,
    injured,
  });
  const name = firstName.trim();

  return (
    <main lang={lang}>
      <div className="progress" aria-hidden>
        {ORDER.map((s, i) => (
          <span key={s} className={i <= progress ? "on" : ""} />
        ))}
      </div>

      {step === "lang" && (
        <section>
          <h1>{STRINGS.en.langTitle}</h1>
          <p className="muted">{STRINGS.en.langSub}</p>
          <div className="choices big">
            <button type="button" className="choice" onClick={() => { setLang("en"); setStep("who"); }}>
              English
            </button>
            <button type="button" className="choice" onClick={() => { setLang("es"); setStep("who"); }}>
              Español
            </button>
          </div>
        </section>
      )}

      {step === "who" && (
        <section>
          <h1>{t.whoTitle}</h1>
          <Choice
            value={runner}
            onChange={setRunner}
            options={[
              { v: "helper", label: t.whoHelper },
              { v: "self", label: t.whoSelf },
            ]}
          />
          {runner && <p className="note">{runner === "helper" ? t.whoHelperNote : t.whoSelfNote}</p>}
          <div className="row nav">
            <button className="btn secondary" onClick={() => go(-1)}>{t.back}</button>
            <button className="btn" disabled={!runner} onClick={() => go(1)}>{t.next}</button>
          </div>
        </section>
      )}

      {step === "profile" && (
        <section>
          <h1>{t.profileTitle}</h1>
          <p className="muted">{runner === "helper" ? t.profileSubHelper : t.profileSubSelf}</p>

          <label className="field">
            <span>{t.nameLabel}</span>
            <input
              type="text"
              autoComplete="off"
              maxLength={40}
              placeholder={t.namePlaceholder}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>{t.ageLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={18}
              max={110}
              value={ageText}
              onChange={(e) => setAgeText(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </label>
          {ageText !== "" && !ageValid && <p className="note bad">{t.ageInvalid}</p>}
          {ageValid && age < STEADI_MIN_AGE && <p className="note">{t.ageUnder65}</p>}

          <div className="field">
            <span>{t.sexLabel}</span>
            <Choice
              value={sex}
              onChange={setSex}
              options={[
                { v: "female", label: t.female },
                { v: "male", label: t.male },
              ]}
            />
          </div>

          <div className="field">
            <span>{t.heightLabel}</span>
            <div className="unit-toggle">
              <button
                type="button"
                className={heightUnit === "imperial" ? "on" : ""}
                onClick={() => setHeightUnit("imperial")}
              >
                {t.feet} / {t.inches}
              </button>
              <button
                type="button"
                className={heightUnit === "metric" ? "on" : ""}
                onClick={() => setHeightUnit("metric")}
              >
                {t.cm}
              </button>
            </div>
            {heightUnit === "imperial" ? (
              <div className="inline-inputs">
                <label>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={t.feet}
                    value={ft}
                    onChange={(e) => setFt(e.target.value.replace(/\D/g, "").slice(0, 1))}
                  />
                  <span>{t.feet}</span>
                </label>
                <label>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={t.inches}
                    value={inch}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setInch(v === "" ? "" : String(Math.min(11, Number(v))));
                    }}
                  />
                  <span>{t.inches}</span>
                </label>
              </div>
            ) : (
              <div className="inline-inputs">
                <label>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={t.cm}
                    value={cmText}
                    onChange={(e) => setCmText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                  <span>{t.cm}</span>
                </label>
              </div>
            )}
            {heightEntered && !heightValid && <p className="note bad">{t.heightInvalid}</p>}
          </div>

          <div className="field">
            <span>{t.aidLabel}</span>
            <Choice
              value={aid}
              onChange={setAid}
              options={[
                { v: "none", label: t.aidNone },
                { v: "cane", label: t.aidCane },
                { v: "walker", label: t.aidWalker },
                { v: "other", label: t.aidOther },
              ]}
            />
            {aid && aid !== "none" && <p className="note">{t.aidNote}</p>}
          </div>

          <div className="row nav">
            <button className="btn secondary" onClick={() => go(-1)}>{t.back}</button>
            <button className="btn" disabled={!profileDone} onClick={() => go(1)}>{t.next}</button>
          </div>
        </section>
      )}

      {step === "screen" && (
        <section>
          <h1>{t.screenTitle}</h1>
          <p className="muted">{t.screenSub}</p>

          <div className="question">
            <p>{t.qUnsteady}</p>
            <Choice value={unsteady} onChange={setUnsteady} options={yesNo} />
          </div>
          <div className="question">
            <p>{t.qWorry}</p>
            <Choice value={worry} onChange={setWorry} options={yesNo} />
          </div>
          <div className="question">
            <p>{t.qFallen}</p>
            <Choice
              value={fallen}
              onChange={(v) => {
                setFallen(v);
                if (!v) {
                  setFallCount(null);
                  setInjured(null);
                }
              }}
              options={yesNo}
            />
          </div>

          {fallen && (
            <div className="followup">
              <div className="question">
                <p>{t.qHowMany}</p>
                <Choice
                  value={fallCount}
                  onChange={setFallCount}
                  options={[
                    { v: "1", label: t.timesOne },
                    { v: "2", label: t.timesTwo },
                    { v: "3+", label: t.timesMore },
                  ]}
                />
              </div>
              <div className="question">
                <p>{t.qInjured}</p>
                <Choice value={injured} onChange={setInjured} options={yesNo} />
              </div>
            </div>
          )}

          <div className="row nav">
            <button className="btn secondary" onClick={() => go(-1)}>{t.back}</button>
            <button className="btn" disabled={!screenDone} onClick={finishScreening}>{t.next}</button>
          </div>
        </section>
      )}

      {step === "result" && (
        <section>
          <h1>
            {name ? `${name}: ` : ""}
            {atRisk ? t.resultTitleRisk : t.resultTitleBaseline}
          </h1>
          <div className={`card ${atRisk ? "warn" : "okcard"}`}>
            <p>{atRisk ? t.resultBodyRisk : t.resultBodyBaseline}</p>
            {fallen && injured && <p><b>{t.resultInjured}</b></p>}
            {fallen && fallCount !== null && fallCount !== "1" && <p><b>{t.resultTwoPlus}</b></p>}
          </div>
          {chairStandNorm(age, sex ?? "female") === null && (
            <p className="note">
              {lang === "en"
                ? "The CDC chair-stand table covers ages 60 to 94, so that test will be shown without a comparison."
                : "La tabla de los CDC para levantarse de la silla cubre de 60 a 94 años, así que esa prueba se mostrará sin comparación."}
            </p>
          )}
          <div className="row nav">
            <button className="btn secondary" onClick={reset}>{t.startOver}</button>
            <Link className="btn" href="/setup">{t.continueTests}</Link>
          </div>
        </section>
      )}

      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
