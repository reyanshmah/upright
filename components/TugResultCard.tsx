import type { Strings } from "../lib/i18n";
import type { TugResult } from "../lib/contract";
import { tugAtRisk } from "../lib/signal/thresholds";
import { StatusBadge } from "./StatusBadge";

const PHASE_KEYS = ["standUp", "walkOut", "turn", "walkBack", "sitDown"] as const;

/**
 * The TUG result in one of four states: under 12 s, 12 s or more, total only,
 * couldn't measure. A refused run shows no number. The phase list appears only
 * when the outcome is Full.
 */
export function TugResultCard({ t, result, reason }: { t: Strings; result: TugResult | null; reason?: string }) {
  if (!result || result.outcome === "refused" || result.totalSec === null) {
    return (
      <div className="card result">
        <StatusBadge kind="none">{t.badgeRefused}</StatusBadge>
        {reason && <p>{reason}</p>}
      </div>
    );
  }
  const total = result.totalSec;
  const atRisk = result.riskFlag ?? tugAtRisk(total);
  const full = result.outcome === "full" && !!result.phases;
  return (
    <div className="card result">
      <p className="result__number">
        <span className="num">{total.toFixed(1)}</span> <span className="result__unit">{t.seconds}</span>
      </p>
      <StatusBadge kind={atRisk ? "risk" : "ok"}>{atRisk ? t.badgeOver12 : t.badgeUnder12}</StatusBadge>
      <StatusBadge kind={full ? "ok" : "total"}>{full ? t.badgeFull : t.badgeTotalOnly}</StatusBadge>
      {full && result.phases ? (
        <>
          <p className="label">{t.phasesTitle}</p>
          <ul className="rows">
            {PHASE_KEYS.map((k) => (
              <li key={k}>
                <span>{t.phaseShort[k]}</span>
                <b>{result.phases![k].toFixed(1)} s</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{t.qualityTotalOnlyNote}</p>
      )}
    </div>
  );
}
