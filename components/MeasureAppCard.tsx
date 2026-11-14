"use client";

import type { Strings } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * iPhone has no web AR, but every recent iPhone has Apple's Measure app,
 * which measures the floor in real distances. Websites can't open it, so this
 * card says how, in four short steps. Shown wherever the 3 m line comes up.
 */
export function MeasureAppCard({ t, onDone, compact = false }: { t: Strings; onDone?: () => void; compact?: boolean }) {
  return (
    <section className="info-card info-card--info measure-app">
      <Icon name="ruler" />
      <div className="stack-sm">
        <h2 className="info-card__title">{t.measureAppTitle}</h2>
        {!compact && <p>{t.measureAppHint}</p>}
        <ol className="steps steps--compact">
          {t.measureAppSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {onDone && (
          <button type="button" className="btn btn--primary" onClick={onDone}>
            {t.measureAppDone}
          </button>
        )}
      </div>
    </section>
  );
}
