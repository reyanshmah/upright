/**
 * Everything the report writer is allowed to say, derived from a validated
 * ReportInput. The model sees only these facts (not the raw JSON, whose gate
 * logs and fps are full of numbers it must never repeat), and the number check
 * allows only these values, in the exact string form the engine shows them.
 */
import { eligibleIds, suggestedIds, type ExerciseId } from "../exercises";
import { focusAreas, stepDetail, stepOrder, type Focus, type PlanContext, type ReportFacts, type StepKey } from "../report";
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
  balance:
    | { status: "skipped" }
    | {
        status: "measured";
        /** Each position tried: held seconds ("6.4") and whether the full 10 s was held. */
        positions: { position: number; heldSec: string; held10: boolean }[];
        /** CDC: could not hold the heel-to-toe (tandem) position for 10 s = increased risk. */
        tandemHeld10: boolean;
      };
  walkingAid: "none" | "cane" | "walker" | "other" | null;
  /** Any risk flag set (screen, TUG >= 12 s, chair stand below average, or tandem under 10 s). */
  higherRisk: boolean;
  /** What this person's plan should focus on, from their own results. */
  focus: Focus[];
  /** The exercise library entries that are safe for this person; the writer may only pick from these. */
  eligibleExercises: ExerciseId[];
  /** The app's own pick, in order of importance (a starting point, not a rule). */
  suggestedExercises: ExerciseId[];
  /** Plan inputs (for the template and the app); left out of the text the writer sees. */
  ctx: PlanContext;
  /** The family plan steps, in order. */
  stepOrder: StepKey[];
  /** One note per step tying it to this person's results (in the FACTS language). */
  personalNotes: Partial<Record<StepKey, string>>;
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

  const b = input.balance;
  const balMeasured = b && !("skipped" in b) ? b : null;
  const balance: WriterFacts["balance"] = balMeasured
    ? {
        status: "measured",
        positions: balMeasured.stages.map((x) => ({ position: x.stage, heldSec: fmtSec(x.heldSec), held10: x.completed })),
        tandemHeld10: balMeasured.tandemHeld10,
      }
    : { status: "skipped" };
  const balRisk = balMeasured ? !balMeasured.tandemHeld10 : null;

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
    balanceAtRisk: balRisk,
    injuredFall: !!s.injured,
    multipleFalls: s.fallCount === "2" || s.fallCount === "3+",
    higherRisk: screenedAtRisk || tugAtRiskFlag === true || chairBelow === true || balRisk === true,
  };

  const failed = balMeasured ? balMeasured.stages.find((x) => !x.completed) ?? null : null;
  const ctx: PlanContext = {
    screening: s,
    walkingAid: input.walkingAid ?? null,
    tugSec: "totalSec" in tug ? tug.totalSec : null,
    tugAtRisk: tugAtRiskFlag,
    chairScore: chair.status === "measured" ? chair.score : null,
    chairNorm: chair.status === "measured" ? chair.norm : null,
    chairBelow,
    armsUsed: chairMeasured ? chairMeasured.armUse : null,
    balance: balMeasured
      ? { tandemHeld10: balMeasured.tandemHeld10, failedStage: failed ? failed.stage : null, failedHeldSec: failed ? fmtSec(failed.heldSec) : null }
      : null,
  };
  const order = stepOrder(reportFacts);
  const personalNotes: Partial<Record<StepKey, string>> = {};
  for (const k of order) {
    const d = stepDetail(k, ctx, input.lang);
    if (d) personalNotes[k] = d;
  }

  const facts: WriterFacts = {
    lang: input.lang,
    ageBand: input.ageBand,
    sex: input.sex,
    screening: { yesCount, screenedAtRisk, ...s },
    tug,
    chair,
    balance,
    walkingAid: input.walkingAid ?? null,
    higherRisk: reportFacts.higherRisk,
    focus: focusAreas(ctx),
    ctx,
    eligibleExercises: eligibleIds(ctx),
    suggestedExercises: suggestedIds(ctx),
    stepOrder: order,
    personalNotes,
  };

  const seconds = new Set<string>(STEADI_CONSTANTS.seconds);
  if ("totalSec" in tug) {
    seconds.add(tug.totalSec);
    for (const v of Object.values(tug.phases ?? {})) seconds.add(v);
  }
  if (balance.status === "measured") {
    seconds.add("10"); // the CDC hold time
    for (const p of balance.positions) seconds.add(p.heldSec);
  }
  const stands = new Set<string>();
  if (chair.status === "measured") {
    stands.add(chair.stands).add(chair.score);
    if (chair.norm) stands.add(chair.norm);
  }
  // "fell 2 times": "times" reads as a count, so the fall count may appear with it.
  if (s.fallCount) stands.add(s.fallCount.replace("+", ""));
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
    // balance position numbers ("position 3")
    ...(balance.status === "measured" ? ["1", "2", "3", "4"] : []),
  ]);
  return { facts, allowed: { seconds, stands, meters, years, bare }, reportFacts };
}
