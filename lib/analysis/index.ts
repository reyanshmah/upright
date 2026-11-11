/**
 * Offline analysis: replays a saved landmark stream through the SAME detectors
 * the app runs live, so the numbers on screen and in saved data always match,
 * and threshold changes can be re-scored on old recordings.
 */
import type { LandmarkStream } from "../signal/types";
import { FeatureExtractor } from "./features";
import { TugDetector, type TugPhases } from "./tug";
import { ChairDetector } from "./chair";

export interface TugAnalysis {
  /** Seconds from the go cue to seated again. */
  totalS: number;
  phases?: TugPhases;
  /** Key moments (ms, stream clock) for the 3 m visibility check. */
  goT: number;
  turnT: number | null;
  endT: number;
}

export interface ChairAnalysis {
  /** Full stands in the 30 s window (halfway rule applied). */
  count: number;
  armsUsed: boolean;
  halfwayCounted: boolean;
}

export function analyzeTug(stream: LandmarkStream): TugAnalysis | null {
  if (stream.goCueT === null) return null;
  const fx = new FeatureExtractor(stream.videoWidth, stream.videoHeight);
  const det = new TugDetector();
  let goSet = false;
  for (const fr of stream.frames) {
    if (!goSet && fr.t >= stream.goCueT) {
      det.setGo(stream.goCueT);
      goSet = true;
    }
    const r = det.push(fx.push(fr.t, fr.landmarks), fr.t);
    if (r.done) {
      const phases = det.phases();
      return {
        totalS: r.totalS!,
        ...(phases ? { phases } : {}),
        goT: stream.goCueT,
        turnT: det.turnPointT(),
        endT: det.endT!,
      };
    }
    if (r.phase === "failed") return null;
  }
  return null;
}

export function analyzeChairStand(stream: LandmarkStream): ChairAnalysis | null {
  if (stream.goCueT === null) return null;
  const fx = new FeatureExtractor(stream.videoWidth, stream.videoHeight);
  const det = new ChairDetector();
  let goSet = false;
  let last = null;
  for (const fr of stream.frames) {
    if (!goSet && fr.t >= stream.goCueT) {
      det.setGo(stream.goCueT);
      goSet = true;
    }
    last = det.push(fx.push(fr.t, fr.landmarks), fr.t);
  }
  // Close the 30 s window even if recording stopped a frame early.
  if (goSet) last = det.push(null, stream.goCueT + 30_000);
  return last ? { count: last.count, armsUsed: last.armsUsed, halfwayCounted: last.halfwayCounted } : null;
}

export { FeatureExtractor, TugDetector, ChairDetector };

export { buildTugResult, buildChairResult, tugMarkVisible } from "./results";
export { checkMark, type MarkCheck } from "./mark";
export type { RunContext, ChairBuild } from "./results";
