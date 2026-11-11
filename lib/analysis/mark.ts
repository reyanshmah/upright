/**
 * 3 m visibility check for the TUG. The phone must see the whole walk, so:
 *  - at the turn point (farthest from the chair): hip, knee and ankle visible,
 *    and the hip inside the frame with a MARK.hipXMargin margin on each side;
 *  - at the start (Go) and at the final sit: the feet visible.
 * Each point is judged over MARK.windowMs of frames, so one noisy frame can't
 * fail (or pass) it. A failure sets markVisible = false, which caps the TUG at
 * Total only. Pure function of the saved stream.
 */
import { missingParts } from "../signal/geometry";
import { ALGO, MARK } from "../signal/thresholds";
import { LM, type Landmark, type LandmarkStream } from "../signal/types";

export interface MarkCheck {
  ok: boolean;
  turnOk: boolean;
  startFeetOk: boolean;
  endFeetOk: boolean;
}

/** The moments to check, in stream time (ms). turnT null = no turn point found. */
export interface MarkTimes {
  goT: number;
  turnT: number | null;
  endT: number;
}

function turnFrameOk(lms: Landmark[]): boolean {
  if (missingParts(lms, ALGO.minVisibility).length) return false; // hips, knees and feet each seen
  const hipX = (lms[LM.leftHip].x + lms[LM.rightHip].x) / 2;
  return hipX >= MARK.hipXMargin && hipX <= 1 - MARK.hipXMargin;
}

function feetOk(lms: Landmark[]): boolean {
  return !missingParts(lms, ALGO.minVisibility).includes("feet");
}

/** True when at least MARK.minPassFrac of the frames around t pass (frames with no pose fail). */
function windowPasses(stream: LandmarkStream, t: number, test: (l: Landmark[]) => boolean): boolean {
  const half = MARK.windowMs / 2;
  const frames = stream.frames.filter((f) => f.t >= t - half && f.t <= t + half);
  if (!frames.length) return false;
  const pass = frames.filter((f) => f.landmarks && test(f.landmarks)).length;
  return pass / frames.length >= MARK.minPassFrac;
}

export function checkMark(stream: LandmarkStream, times: MarkTimes): MarkCheck {
  const turnOk = times.turnT !== null && windowPasses(stream, times.turnT, turnFrameOk);
  const startFeetOk = windowPasses(stream, times.goT, feetOk);
  const endFeetOk = windowPasses(stream, times.endT, feetOk);
  return { ok: turnOk && startFeetOk && endFeetOk, turnOk, startFeetOk, endFeetOk };
}
