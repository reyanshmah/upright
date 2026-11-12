"use client";

import { useId, type ReactNode } from "react";

/**
 * Form building blocks for older adults: big radio cards (native radios, so
 * keyboard and screen readers work as expected), labelled fields with a hint
 * line, and inline errors.
 */
export function ChoiceGroup<T extends string | boolean>({
  legend,
  hint,
  value,
  options,
  onChange,
  layout = "stack",
  legendClass = "label",
}: {
  legend: ReactNode;
  hint?: ReactNode;
  value: T | null;
  options: { v: T; label: ReactNode; sub?: ReactNode }[];
  onChange: (v: T) => void;
  layout?: "stack" | "row" | "grid";
  legendClass?: string;
}) {
  const name = useId();
  const hintId = `${name}-hint`;
  return (
    <fieldset className="choice-group" aria-describedby={hint ? hintId : undefined}>
      <legend className={legendClass}>{legend}</legend>
      {hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div className={`choices choices--${layout}`}>
        {options.map((o) => (
          <label key={String(o.v)} className="choice">
            <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />
            <span className="choice__dot" aria-hidden />
            <span className="choice__text">
              <span className="choice__label">{o.label}</span>
              {o.sub ? <span className="choice__sub">{o.sub}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  optional?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Render prop gets the ids to wire the input up. */
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
        {optional ? <span className="label__optional"> ({optional})</span> : null}
      </label>
      {children({ id, describedBy })}
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
