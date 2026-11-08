/**
 * ANALYSIS SLOTS: rebuild these at the hackathon.
 *
 * The whole app already calls these functions after each test with the
 * recorded landmark stream. Return null and the app falls back to the
 * helper's manual tap/count; return a value and it is shown as the measured
 * result (the manual number is kept for the stopwatch comparison).
 *
 * Inputs are pure data (LandmarkStream: timestamps + 33 points per frame,
 * goCueT = performance.now() when the "go" cue played), so these can be unit
 * tested on saved recordings without a camera.
 *
 * Useful building blocks already in lib/signal/: OneEuroFilter, kneeAngle,
 * bodyScalePx, cameraSide, StandStateMachine, countChairStands, thresholds.
 */
import type { LandmarkStream } from "../signal/types";

export interface TugAnalysis {
  /** Seconds from the go cue to seated and still. */
  totalS: number;
  /** Optional five-phase breakdown (seconds). */
  phases?: { standUp: number; walkOut: number; turn: number; walkBack: number; sitDown: number };
}

export interface ChairAnalysis {
  /** Full stands in the 30 s window (STEADI halfway rule applied). */
  count: number;
  /** True if arms were used to rise (score becomes 0). */
  armsUsed: boolean;
}

export function analyzeTug(_stream: LandmarkStream): TugAnalysis | null {
  return null; // TODO(hackathon)
}

export function analyzeChairStand(_stream: LandmarkStream): ChairAnalysis | null {
  return null; // TODO(hackathon)
}
