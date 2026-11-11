/**
 * THE contract between the engine, the interface, the backend and the study
 * (MASTER.md "Workstreams"). The engine returns one of these per test; the UI
 * renders it, the backend sends it, the study stores it. Change it only by
 * agreement: bump schemaVersion and update MASTER.md in the same commit.
 */
export type Outcome = "full" | "total_only" | "refused";

export interface GateEvent {
  /** Milliseconds relative to the Go cue (negative = before Go). */
  t: number;
  gate: "body" | "one_person" | "fps" | "light" | "seated" | "arms";
  ok: boolean;
}

export type TugRefusalReason =
  | "fps_low"
  | "second_person"
  | "not_visible_at_start_or_end"
  | "aborted"
  | "tab_hidden";

export interface TugResult {
  schemaVersion: 1;
  outcome: Outcome;
  refusalReason?: TugRefusalReason;
  /** null when refused */
  totalSec: number | null;
  /** totalSec >= 12, null when refused */
  riskFlag: boolean | null;
  /** only when outcome === "full" */
  phases?: { standUp: number; walkOut: number; turn: number; walkBack: number; sitDown: number };
  /** about 1 / median fps */
  timingErrorSec: number;
  medianFps: number;
  gateLog: GateEvent[];
}

export interface ChairStandResult {
  schemaVersion: 1;
  outcome: "full" | "refused";
  refusalReason?: string;
  stands: number | null;
  armUse: boolean;
  /** CDC age and sex table */
  belowNorm: boolean | null;
  medianFps: number;
  gateLog: GateEvent[];
}
