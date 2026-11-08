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

/** Algorithm constants (from the execution plan; tune on saved streams). */
export const ALGO = {
  /** Knee angle below this = SEATED (degrees). */
  seatedKneeDeg: 110,
  /** Knee angle above this = STANDING (degrees). */
  standingKneeDeg: 160,
  /** A new state must hold this many consecutive frames (hysteresis). */
  holdFrames: 3,
  /** Chair-stand test window (seconds). */
  chairStandWindowS: 30,
  /** Arm-use flag: wrist farther than this many body scales from opposite shoulder. */
  armUseBodyScales: 0.6,
  /** Minimum live frame rate for a test to be scored. */
  minFps: 15,
  /** Minimum landmark visibility for the whole-body gate. */
  minVisibility: 0.5,
} as const;
