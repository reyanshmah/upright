/**
 * Clinical thresholds and algorithm constants.
 *
 * Clinical values come from the official CDC STEADI forms. Copy them from the
 * PDFs, never from memory.
 */

/**
 * CDC STEADI TUG form: "An older adult who takes >=12 seconds to complete the
 * TUG is at risk for falling." Note: greater than OR EQUAL to 12.
 * Source: https://www.cdc.gov/steadi/pdf/steadi-assessment-tug-508.pdf
 */
export const TUG_RISK_SECONDS = 12;

export function tugAtRisk(totalSeconds: number): boolean {
  return totalSeconds >= TUG_RISK_SECONDS;
}

/**
 * 30-Second Chair Stand "Below Average Scores", copied from the CDC STEADI
 * 30-Second Chair Stand assessment form (2017). A score BELOW the value is
 * below average and "indicates a risk for falls."
 *
 * Form rules also encoded here:
 * - Chair: straight back, no armrests, seat 17" high.
 * - Arms crossed at the wrists on opposite shoulders. "If the patient must use
 *   his/her arms to stand, stop the test. Record '0' for the number and score."
 * - "If the patient is over halfway to a standing position when 30 seconds
 *   have elapsed, count it as a stand."
 */
export type Sex = "female" | "male";
export interface ChairStandNorm {
  ageMin: number;
  ageMax: number;
  /** A score BELOW this value is below average. */
  male: number;
  female: number;
}
export const CHAIR_STAND_NORMS: ChairStandNorm[] = [
  { ageMin: 60, ageMax: 64, male: 14, female: 12 },
  { ageMin: 65, ageMax: 69, male: 12, female: 11 },
  { ageMin: 70, ageMax: 74, male: 12, female: 10 },
  { ageMin: 75, ageMax: 79, male: 11, female: 10 },
  { ageMin: 80, ageMax: 84, male: 10, female: 9 },
  { ageMin: 85, ageMax: 89, male: 8, female: 8 },
  { ageMin: 90, ageMax: 94, male: 7, female: 4 },
];

export function chairStandNorm(age: number, sex: Sex): number | null {
  const row = CHAIR_STAND_NORMS.find((r) => age >= r.ageMin && age <= r.ageMax);
  return row ? row[sex] : null;
}

export interface ChairStandScore {
  /** Score to record: 0 if arms were needed, per the CDC form. */
  score: number;
  /** Below-average cutoff for this age/sex, or null if the CDC table has no row. */
  norm: number | null;
  /** true = below average (risk); null = no CDC norm for this age. */
  belowAverage: boolean | null;
}

export function scoreChairStand(count: number, armsUsed: boolean, age: number, sex: Sex): ChairStandScore {
  const score = armsUsed ? 0 : count;
  const norm = chairStandNorm(age, sex);
  return { score, norm, belowAverage: norm === null ? null : score < norm };
}

/**
 * ALL tunable numbers live in this file (MASTER.md rule: never inline a number
 * in a detector). Bump CONFIG_VERSION on every change; thresholds freeze on
 * Nov 14 (v1.0), after that only bug fixes.
 */
export const CONFIG_VERSION = "2026-11-11.1";

/** Algorithm constants shared by the live gates and the tests. */
export const ALGO = {
  /** Chair-stand test window (seconds). */
  chairStandWindowS: 30,
  /** Minimum live frame rate for a test to be scored. */
  minFps: 15,
  /** Minimum landmark visibility for the whole-body gate. */
  minVisibility: 0.4,
} as const;

/** Live gate hysteresis: a gate turns ON after onMs of good frames, OFF after offMs of bad ones. */
export const GATES = {
  body: { onMs: 300, offMs: 600 },
  onePerson: { onMs: 300, offMs: 600 },
  fps: { onMs: 500, offMs: 1000 },
  seated: { onMs: 400, offMs: 600 },
  arms: { onMs: 400, offMs: 600 },
  /** Start stays disabled until every gate has been green this long. */
  allGreenHoldMs: 700,
  /** A second person in view longer than this (ms, inside the run) refuses the test. */
  secondPersonRefuseMs: 500,
  /** Whole-body gate off this long at the start or end of a TUG = person not visible there. */
  tugEdgeWindowMs: 500,
  /** Chair stand: refuse if the body gate was off for more than this fraction of the 30 s window. */
  chairMaxBodyOffFrac: 0.1,
} as const;

/** Per-frame features (lib/analysis/features.ts). */
export const FEATURES = {
  /** Landmark counts as usable above this visibility and inside the image. */
  minVisibility: 0.3,
  frameMargin: 0.02,
  minShankPx: 5,
  /** Rolling window for the median shank length (samples; both legs add one per frame). */
  shankWindow: 120,
  hipXFilter: { minCutoff: 1.5, beta: 0.01, dCutoff: 1 },
  hipHFilter: { minCutoff: 1.5, beta: 0.01, dCutoff: 1 },
  kneeFilter: { minCutoff: 1.5, beta: 0.02, dCutoff: 1 },
  wristMinVisibility: 0.4,
  /** Wrist is "low" when below shoulder + this fraction of the torso length. */
  wristLowTorsoFrac: 0.65,
} as const;

/** Raw per-frame posture class: knee angle (deg) AND hip height (shank lengths) must agree. */
export const POSTURE = {
  seatedKneeDeg: 125,
  seatedHipH: 1.45,
  standingKneeDeg: 140,
  standingHipH: 1.55,
  /** Default time a posture must hold before it is accepted (ms). */
  holdMs: 150,
  /** In-between frames for longer than this (ms) break a posture run. */
  gapMs: 500,
  /** The person's own seated hip height: median of up to this many seated frames, needs at least the min. */
  seatedBaseWindow: 60,
  seatedBaseMinFrames: 5,
  /** Person-relative rule for in-between frames: hip this far above their seated height AND knee this straight = standing. */
  relStandingRiseH: 0.45,
  relStandingKneeDeg: 135,
  /** ...hip within this of their seated height AND knee this bent = seated. */
  relSeatedRiseH: 0.15,
  relSeatedKneeDeg: 130,
} as const;

/** Timed Up and Go detector (lib/analysis/tug.ts). Distances are in shank lengths. */
export const TUG = {
  /** Walked away from the chair (~1.1 m). */
  leftChair: 2.5,
  /** Must get this far before a turn counts. */
  minTurnD: 3.5,
  /** Within this of the chair = back at the chair. */
  backNear: 2.5,
  /** Hard limit: the test stops and is refused (MASTER.md: 60 s). */
  timeoutMs: 60_000,
  /** No usable pose for this long = person lost. */
  lostMs: 5_000,
  /** Raw posture hold for the main tracker, and for the final seated check. */
  postureHoldMs: 150,
  seatedFinalHoldMs: 300,
  /** Seated frames kept to learn where the chair is before Go. */
  preSeatedFrames: 45,
  /** Turn = distance fell this far below the farthest point. */
  turnDropD: 1.0,
  /** Live "turn" label: at least this fraction of max distance and slower than turnSpeed. */
  turnNearMaxFrac: 0.7,
  turnSpeed: 0.8,
  /** Window for displacement speed (ms). */
  speedWindowMs: 400,
  /** End check tolerates this much extra distance from the chair. */
  endExtraD: 0.5,
  /** A seated run survives non-seated frames for up to this long (ms). */
  sitRunGapMs: 500,
  /** Backup stand detection: this far from the chair and not seated = they stood; stand time = first frame with hip above backupStandHipH. */
  backupStandD: 1.5,
  backupStandHipH: 1.5,
  /** Phase split: smoothing half-window (ms), percentile of speed, turn edge fraction, min frames. */
  phaseSmoothMs: 250,
  phaseSpeedPercentile: 0.8,
  phaseEdgeFrac: 0.3,
  phaseMinFrames: 10,
  /** TUG >= this many seconds: the app suggests skipping the chair stand for safety. */
  verySlowS: 20,
} as const;

/**
 * 3 m visibility check during the TUG (lib/analysis/mark.ts). NEW on Nov 11;
 * no existing value changed. Failing it sets markVisible = false (Total only).
 */
export const MARK = {
  /** At the turn point the hip must be inside the frame by this fraction of its width. */
  hipXMargin: 0.05,
  /** Frames checked around each point (ms, centred on it). */
  windowMs: 500,
  /** Fraction of the frames in that window that must pass. */
  minPassFrac: 0.5,
} as const;

/** 30-Second Chair Stand detector (lib/analysis/chair.ts). */
export const CHAIR = {
  postureHoldMs: 100,
  /** A low wrist must persist this long to count as arm use (ms). */
  armsMs: 200,
  /** "Rising" = hip height within this of the seated/standing midpoint. */
  risingMargin: 0.25,
  /** Defaults for the seated/standing hip heights until observed. */
  defaultSeatedH: 1.15,
  defaultStandingH: 1.95,
} as const;
