/**
 * Everything the report writer is allowed to say, derived from a validated
 * ReportInput. The model sees only these facts (not the raw JSON, whose gate
 * logs and fps are full of numbers it must never repeat), and the number check
 * allows only these values, in the exact string form the engine shows them.
 */
import { stepOrder, type ReportFacts, type StepKey } from "../report";
import { bandAge } from "../sessionFile";
import { chairStandNorm, scoreChairStand, TUG_RISK_SECONDS } from "../signal/thresholds";
import type { ReportInput } from "./schema";

/** Fixed constants from the STEADI guidance the text may mention. */
export const STEADI_CONSTANTS = {
  /** TUG risk cutoff (s) and the chair-stand window (s). */
  seconds: [String(TUG_RISK_SECONDS), "30"],
  /** The TUG walking line (m). */
  meters: ["3"],
  /** STEADI is for adults 65 and older; there are 3 key screening questions. */
  bare: ["65", "3"],
} as const;

export const fmtSec = (s: number) => s.toFixed(1);

export interface WriterFacts {
  lang: "en" | "es";
  ageBand: string;
  sex: "female" | "male";
  screening: {
    yesCount: number;
    screenedAtRisk: boolean;
    unsteady: boolean;
    worry: boolean;
    fallen: boolean;
    fallCount: "1" | "2" | "3+" | null;
    injured: boolean | null;
  };
  tug:
    | { status: "skipped" | "could_not_measure" }
    | { status: "full" | "total_only"; totalSec: string; atRisk: boolean; phases?: Record<string, string> };
  chair:
    | { status: "skipped" | "could_not_measure" }
    | { status: "measured"; score: string; stands: string; armsUsed: boolean; norm: string | null; belowAverage: boolean | null };
  /** Any risk flag set (screen, TUG >= 12 s, or chair stand below average). */
  higherRisk: boolean;
  /** The family plan steps, in order. */
  stepOrder: StepKey[];
}

/** Allowed numerals, by the unit they may appear with. */
export interface AllowedNumbers {
  seconds: Set<string>;
  stands: Set<string>;
  meters: Set<string>;
  years: Set<string>;
  /** A numeral with no recognised unit after it may be any allowed value. */
  bare: Set<string>;
}

export function writerFacts(input: ReportInput): { facts: WriterFacts; allowed: AllowedNumbers; reportFacts: ReportFacts } {
  const s = input.screening;
  const yesCount = [s.unsteady, s.worry, s.fallen].filter(Boolean).length;
  const screenedAtRisk = yesCount > 0;

  const t = input.tug;
  const tugMeasured = t && !("skipped" in t) && t.outcome !== "refused" && t.totalSec !== null ? t : null;
  const tug: WriterFacts["tug"] = tugMeasured
    ? {
        status: tugMeasured.outcome === "full" ? "full" : "total_only",
        totalSec: fmtSec(tugMeasured.totalSec!),
        atRisk: tugMeasured.riskFlag === true,
        ...(tugMeasured.outcome === "full" && tugMeasured.phases
          ? { phases: Object.fromEntries(Object.entries(tugMeasured.phases).map(([k, v]) => [k, fmtSec(v)])) }
          : {}),
      }
    : { status: t && !("skipped" in t) ? "could_not_measure" : "skipped" };

  const c = input.chair;
  const chairMeasured = c && !("skipped" in c) && c.outcome === "full" && c.stands !== null ? c : null;
  const age = bandAge(input.ageBand);
  const sc = chairMeasured ? scoreChairStand(chairMeasured.stands!, chairMeasured.armUse, age, input.sex) : null;
  const norm = chairStandNorm(age, input.sex);
  const chair: WriterFacts["chair"] =
    chairMeasured && sc
      ? {
          status: "measured",
          score: String(sc.score),
          stands: String(chairMeasured.stands),
          armsUsed: chairMeasured.armUse,
          norm: norm === null ? null : String(norm),
          belowAverage: sc.belowAverage,
        }
      : { status: c && !("skipped" in c) ? "could_not_measure" : "skipped" };

  const tugAtRiskFlag = tugMeasured ? tugMeasured.riskFlag : null;
  const chairBelow = sc ? sc.belowAverage : null;
  const reportFacts: ReportFacts = {
    screenedAtRisk,
    tugS: tugMeasured ? tugMeasured.totalSec : null,
    tugAtRisk: tugAtRiskFlag,
    chairScore: sc ? sc.score : null,
    chairNorm: sc ? sc.norm : null,
    chairBelow,
    armsUsed: chairMeasured ? chairMeasured.armUse : null,
    // The report route's input carries TUG and chair only; the balance test is not sent yet.
    balanceAtRisk: null,
    injuredFall: !!s.injured,
    multipleFalls: s.fallCount === "2" || s.fallCount === "3+",
    higherRisk: screenedAtRisk || tugAtRiskFlag === true || chairBelow === true,
  };

  const facts: WriterFacts = {
    lang: input.lang,
    ageBand: input.ageBand,
    sex: input.sex,
    screening: { yesCount, screenedAtRisk, ...s },
    tug,
    chair,
    higherRisk: reportFacts.higherRisk,
    stepOrder: stepOrder(reportFacts),
  };

  const seconds = new Set<string>(STEADI_CONSTANTS.seconds);
  if ("totalSec" in tug) {
    seconds.add(tug.totalSec);
    for (const v of Object.values(tug.phases ?? {})) seconds.add(v);
  }
  const stands = new Set<string>();
  if (chair.status === "measured") {
    stands.add(chair.stands).add(chair.score);
    if (chair.norm) stands.add(chair.norm);
  }
  const meters = new Set<string>(STEADI_CONSTANTS.meters);
  const years = new Set<string>(["65", ...(input.ageBand.match(/\d+/g) ?? [])]);
  const bare = new Set<string>([
    ...seconds,
    ...stands,
    ...meters,
    ...years,
    ...STEADI_CONSTANTS.bare,
    String(yesCount),
    ...(s.fallCount ? [s.fallCount.replace("+", "")] : []),
  ]);
  return { facts, allowed: { seconds, stands, meters, years, bare }, reportFacts };
}
