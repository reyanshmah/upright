"use client";

import { useEffect, useState } from "react";
import type { Strings } from "@/lib/i18n";
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM } from "@/lib/measure";
import { Icon } from "./Icon";

export type HeightUnit = "imperial" | "metric";

/** Where the − / + buttons start when nothing is entered yet (typical adult heights). */
const START_CM = { female: 163, male: 175, unknown: 168 } as const;
const IN = 2.54;

const toInches = (cm: number) => Math.round(cm / IN);
const ftIn = (cm: number) => {
  const total = toInches(cm);
  return { ft: Math.floor(total / 12), inch: total % 12 };
};

/**
 * Height entry built for older hands: big − / + buttons (1 inch or 1 cm per
 * tap), typing still works, and the other unit is shown underneath so the
 * number can be checked at a glance.
 */
export function HeightInput({
  t,
  unit,
  onUnit,
  cm,
  onCm,
  sex,
  showError,
}: {
  t: Strings;
  unit: HeightUnit;
  onUnit: (u: HeightUnit) => void;
  cm: number | null;
  onCm: (cm: number | null) => void;
  sex: "female" | "male" | null;
  showError: boolean;
}) {
  // Text in the boxes, kept separately so half-typed numbers aren't overwritten.
  const [ftText, setFtText] = useState("");
  const [inText, setInText] = useState("");
  const [cmText, setCmText] = useState("");
  useEffect(() => {
    if (cm === null) return;
    const v = ftIn(cm);
    setFtText(String(v.ft));
    setInText(String(v.inch));
    setCmText(String(Math.round(cm)));
    // Only when the value or unit changes from outside the boxes (buttons, unit switch, resume).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const valid = cm !== null && cm >= HEIGHT_MIN_CM && cm <= HEIGHT_MAX_CM;
  const step = (dir: 1 | -1) => {
    const base = cm ?? START_CM[sex ?? "unknown"];
    let next: number;
    if (cm === null) next = base;
    else if (unit === "imperial") next = (toInches(base) + dir) * IN;
    else next = Math.round(base) + dir;
    next = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, next));
    onCm(next);
    const v = ftIn(next);
    setFtText(String(v.ft));
    setInText(String(v.inch));
    setCmText(String(Math.round(next)));
  };
  const fromImperial = (f: string, i: string) => {
    if (f === "") return onCm(null);
    onCm((Number(f) * 12 + Number(i || 0)) * IN);
  };

  return (
    <fieldset className="choice-group height">
      <legend className="label">{t.heightLabel}</legend>
      <p className="hint">{t.heightHint}</p>
      <div className="segmented" role="group" aria-label={t.heightUnitLabel}>
        <button type="button" aria-pressed={unit === "imperial"} onClick={() => onUnit("imperial")}>
          {t.feet} + {t.inches}
        </button>
        <button type="button" aria-pressed={unit === "metric"} onClick={() => onUnit("metric")}>
          {t.cm}
        </button>
      </div>

      <div className="stepper">
        <button type="button" className="stepper__btn" aria-label={t.heightLess} onClick={() => step(-1)}>
          <Icon name="minus" size={28} />
        </button>
        <div className="stepper__value">
          {unit === "imperial" ? (
            <>
              <span className="input-unit">
                <input
                  className="input input--short"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={`${t.heightLabel}, ${t.feet}`}
                  aria-invalid={showError && !valid}
                  value={ftText}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                    setFtText(v);
                    fromImperial(v, inText);
                  }}
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
                  aria-invalid={showError && !valid}
                  value={inText}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const v = raw === "" ? "" : String(Math.min(11, Number(raw)));
                    setInText(v);
                    fromImperial(ftText, v);
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
                aria-invalid={showError && !valid}
                value={cmText}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setCmText(v);
                  onCm(v === "" ? null : Number(v));
                }}
              />
              <span className="input-unit__suffix">{t.cm}</span>
            </span>
          )}
        </div>
        <button type="button" className="stepper__btn" aria-label={t.heightMore} onClick={() => step(1)}>
          <Icon name="plus" size={28} />
        </button>
      </div>

      {valid && (
        <p className="height__other" aria-live="polite">
          {unit === "imperial" ? t.heightIsCm(Math.round(cm!)) : t.heightIsFtIn(ftIn(cm!).ft, ftIn(cm!).inch)}
        </p>
      )}
      {showError && !valid && (
        <p className="field-error" role="alert">
          {t.heightInvalid}
        </p>
      )}
    </fieldset>
  );
}
