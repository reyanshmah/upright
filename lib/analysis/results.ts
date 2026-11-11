/**
 * Turns a landmark stream + run context into the typed result contract
 * (lib/contract.ts), including the quality outcome. Pure: the live app and the
 * offline replay both call these, so a downloaded session file re-scores to
 * the same result that was on screen.
 *
 * Outcome rules (MASTER.md "Failure defenses"):
 *  - Refused:    aborted, tab hidden, fps below the minimum, a second person in
 *                view, no total time, or the body not visible at the start/end.
 *                A refused test carries NO number.
 *  - Total only: a TUG total exists but the whole-body gate dropped mid-walk,
 *                the phases could not be found, or the 3 m mark was out of
 *                frame. Phases are hidden.
 *  - Full:       every gate held.
 */
import type { ChairStandResult, GateEvent, TugRefusalReason, TugResult } from "../contract";
import { gateOffMs } from "../signal/gate";
import type { LandmarkStream } from "../signal/types";
import { ALGO, GATES, scoreChairStand, tugAtRisk, type Sex } from "../signal/thresholds";
import { analyzeChairStand, analyzeTug, type TugAnalysis } from "./index";
import { checkMark } from "./mark";
import type { TugPhases } from "./tug";

export interface RunContext {
  /** Median live fps during the recording. */
  medianFps: number | null;
  gateLog: GateEvent[];
  aborted?: boolean;
  tabHidden?: boolean;
  /**
   * Was the whole 3 m walk visible (lib/analysis/mark.ts)? undefined = work it
   * out from the stream; null = unknown, which does not block Full; false caps
   * the outcome at Total only. A false from either source wins.
   */
  markVisible?: boolean | null;
}

/** Live detector values, used only when replaying the stream finds nothing. */
export interface LiveTug { totalS: number | null; phases?: TugPhases | null }
export interface LiveChair { count: number; armsUsed: boolean; halfwayCounted: boolean }

const round1 = (x: number) => Math.round(x * 10) / 10;

function common(ctx: RunContext) {
  const medianFps = ctx.medianFps ?? 0;
  return {
    schemaVersion: 1 as const,
    medianFps: Math.round(medianFps * 10) / 10,
    gateLog: ctx.gateLog,
  };
}

/** Reasons that apply to both tests, in priority order. */
function commonRefusal(ctx: RunContext, fromMs: number, toMs: number): TugRefusalReason | null {
  if (ctx.aborted) return "aborted";
  if (ctx.tabHidden) return "tab_hidden";
  if (ctx.medianFps === null || ctx.medianFps < ALGO.minFps) return "fps_low";
  if (gateOffMs(ctx.gateLog, "one_person", fromMs, toMs) > GATES.secondPersonRefuseMs) return "second_person";
  return null;
}

/** 3 m visibility from a replay: null when the replay found no TUG to check. */
function markFromAnalysis(stream: LandmarkStream, a: TugAnalysis | null): boolean | null {
  return a ? checkMark(stream, { goT: a.goT, turnT: a.turnT, endT: a.endT }).ok : null;
}

/** 3 m visibility for a TUG stream (true / false, or null if no TUG was found). */
export function tugMarkVisible(stream: LandmarkStream): boolean | null {
  return markFromAnalysis(stream, analyzeTug(stream));
}

export function buildTugResult(stream: LandmarkStream, ctx: RunContext, live?: LiveTug): TugResult {
  const a = analyzeTug(stream);
  const computed = ctx.markVisible === undefined ? markFromAnalysis(stream, a) : null;
  const markVisible = ctx.markVisible === false || computed === false ? false : (ctx.markVisible ?? computed);
  const totalS = a?.totalS ?? live?.totalS ?? null;
  const phases = a?.phases ?? live?.phases ?? undefined;
  const base = common(ctx);
  const timingErrorSec = base.medianFps > 0 ? Math.round((1 / base.medianFps) * 1000) / 1000 : 0;
  const refuse = (refusalReason: TugRefusalReason): TugResult => ({
    ...base,
    outcome: "refused",
    refusalReason,
    totalSec: null,
    riskFlag: null,
    timingErrorSec,
  });

  const endMs = totalS === null ? 0 : totalS * 1000;
  const early = commonRefusal(ctx, 0, endMs);
  if (early) return refuse(early);
  if (totalS === null) return refuse("not_visible_at_start_or_end");

  const edge = GATES.tugEdgeWindowMs;
  const offAtStart = gateOffMs(ctx.gateLog, "body", 0, edge) > 0;
  const offAtEnd = gateOffMs(ctx.gateLog, "body", endMs - edge, endMs) > 0;
  if (offAtStart || offAtEnd) return refuse("not_visible_at_start_or_end");

  const totalSec = round1(totalS);
  const bodyHeld = gateOffMs(ctx.gateLog, "body", 0, endMs) === 0;
  const full = bodyHeld && !!phases && markVisible !== false;
  return {
    ...base,
    outcome: full ? "full" : "total_only",
    totalSec,
    riskFlag: tugAtRisk(totalSec),
    ...(full && phases ? { phases } : {}),
    timingErrorSec,
  };
}

/** Chair result plus the one UI-only extra (halfway rule), kept out of the contract. */
export type ChairBuild = ChairStandResult & { halfwayCounted: boolean };

export function buildChairResult(
  stream: LandmarkStream,
  ctx: RunContext,
  person: { age: number; sex: Sex },
  live?: LiveChair,
): ChairBuild {
  const a = analyzeChairStand(stream);
  const count = a?.count ?? live?.count ?? null;
  const armUse = a?.armsUsed ?? live?.armsUsed ?? false;
  const halfwayCounted = a?.halfwayCounted ?? live?.halfwayCounted ?? false;
  const base = common(ctx);
  const refuse = (refusalReason: string): ChairBuild => ({
    ...base,
    outcome: "refused",
    refusalReason,
    stands: null,
    armUse,
    belowNorm: null,
    halfwayCounted: false,
  });

  const windowMs = ALGO.chairStandWindowS * 1000;
  const early = commonRefusal(ctx, 0, windowMs);
  if (early) return refuse(early);
  if (count === null) return refuse("not_visible_at_start_or_end");
  if (gateOffMs(ctx.gateLog, "body", 0, windowMs) > GATES.chairMaxBodyOffFrac * windowMs) {
    return refuse("not_visible_at_start_or_end");
  }
  return {
    ...base,
    outcome: "full",
    stands: count,
    armUse,
    belowNorm: scoreChairStand(count, armUse, person.age, person.sex).belowAverage,
    halfwayCounted,
  };
}
