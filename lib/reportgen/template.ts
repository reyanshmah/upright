/**
 * The deterministic report: used when no API key is set, when the model fails
 * twice, or offline. Same wording as the results screen (lib/report.ts
 * STEP_TEXT + stepOrder), plus a factual clinician summary. Always passes
 * checkReport (tested on all 20 fixtures).
 */
import { STRINGS } from "../i18n";
import { STEP_TEXT } from "../report";
import type { WriterFacts } from "./facts";
import type { ReportOutput } from "./schema";

const SUMMARY = {
  en: {
    higher: "These results suggest a higher risk of falling.",
    lower: "No fall risk signs were found today.",
    repeated: "Repeated falls in the past year are important to share with the doctor.",
  },
  es: {
    higher: "Estos resultados sugieren un riesgo mayor de caídas.",
    lower: "Hoy no se encontraron señales de riesgo de caídas.",
    repeated: "Las caídas repetidas en el último año son importantes para compartir con el médico.",
  },
};

function clinician(f: WriterFacts): string {
  const s = f.screening;
  const parts: string[] = [];
  const sexWord = f.sex === "female" ? "female" : "male";
  parts.push(`Age band ${f.ageBand}, ${sexWord}.`);
  let screen = `STEADI key questions: ${s.yesCount} of 3 answered yes (${s.screenedAtRisk ? "screened at risk" : "screened not at risk"})`;
  if (s.fallen) screen += `; fell in the past year (${s.fallCount ?? "count not given"}${s.injured ? ", injured" : ""})`;
  parts.push(`${screen}.`);

  const t = f.tug;
  if (t.status === "full" || t.status === "total_only") {
    let line = `Timed Up and Go: ${t.totalSec} s (${t.atRisk ? "at or above" : "below"} the CDC 12 s cutoff; ${
      t.status === "full" ? "full measurement" : "total time only, step breakdown hidden"
    })`;
    if (t.phases) {
      const p = t.phases;
      line += `; stand up ${p.standUp} s, walk out ${p.walkOut} s, turn ${p.turn} s, walk back ${p.walkBack} s, sit down ${p.sitDown} s`;
    }
    parts.push(`${line}.`);
  } else {
    parts.push(t.status === "skipped" ? "Timed Up and Go: not done." : "Timed Up and Go: could not be measured (camera quality check failed); no time recorded.");
  }

  const c = f.chair;
  if (c.status === "measured") {
    const how = c.armsUsed ? " (arms used to stand, scored 0 per the CDC form)" : ` (${c.stands} stands)`;
    const norm =
      c.norm === null
        ? "no CDC norm for this age"
        : `CDC below-average cutoff for this age and sex: below ${c.norm} (${c.belowAverage ? "below average" : "not below average"})`;
    parts.push(`30-Second Chair Stand: score ${c.score}${how}; ${norm}.`);
  } else {
    parts.push(c.status === "skipped" ? "30-Second Chair Stand: not done." : "30-Second Chair Stand: could not be measured; no score recorded.");
  }
  const b = f.balance;
  if (b.status === "measured") {
    const held = b.positions.map((p) => `position ${p.position} ${p.heldSec} s${p.held10 ? "" : " (feet moved)"}`).join(", ");
    parts.push(
      `4-Stage Balance: ${held}; ${b.tandemHeld10 ? "tandem stance held 10 s" : "could not hold the tandem stance for 10 s (CDC: increased fall risk)"}.`,
    );
  }
  parts.push(STRINGS.en.disclaimer);
  return parts.join(" ");
}

export function templateReport(f: WriterFacts): ReportOutput {
  const lang = f.lang;
  const t = SUMMARY[lang];
  const summary = [f.higherRisk ? t.higher : t.lower];
  if (f.screening.injured) summary.push(STRINGS[lang].resultInjured);
  if (f.screening.fallCount === "2" || f.screening.fallCount === "3+") summary.push(t.repeated);
  summary.push(STRINGS[lang].disclaimer);
  return {
    familySummary: summary.join(" "),
    familySteps: f.stepOrder.map((k) => ({ ...STEP_TEXT[lang][k] })),
    clinicianSummary: clinician(f),
  };
}
