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
 * 30-Second Chair Stand below-average scores by age and sex.
 * TODO(before Nov 10): copy this table from the official CDC STEADI
 * 30-Second Chair Stand form. Left empty on purpose so nobody ships numbers
 * typed from memory. scoreChairStand() throws until it is filled in.
 */
export type Sex = "female" | "male";
export interface ChairStandNorm {
  ageMin: number;
  ageMax: number;
  /** A score BELOW this value is below average (per the CDC form wording). */
  female: number;
  male: number;
}
export const CHAIR_STAND_NORMS: ChairStandNorm[] = [];

export function chairStandBelowNorm(count: number, age: number, sex: Sex): boolean {
  if (CHAIR_STAND_NORMS.length === 0) {
    throw new Error("CHAIR_STAND_NORMS is empty: copy the table from the CDC STEADI form first.");
  }
  const row = CHAIR_STAND_NORMS.find((r) => age >= r.ageMin && age <= r.ageMax);
  if (!row) throw new Error(`No CDC chair-stand norm for age ${age}`);
  return count < row[sex];
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
