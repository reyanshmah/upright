/**
 * Upright correction for a rotated camera picture.
 *
 * With the phone's rotation lock on (or the phone held upside down) the
 * picture reaches the pose model sideways or upside down, but every detector
 * assumes image "up" is real up. The body tells us which way is up: the
 * hip-to-shoulder direction, summed over frames, snapped to the nearest
 * quarter turn (a phone only ever turns in quarter turns). Landmarks are then
 * rotated into an upright frame before recording and analysis, so live and
 * replayed results agree. Drawing still uses the raw landmarks.
 */
import { LM, type Landmark } from "../signal/types";

/** Clockwise quarter turns needed to make the picture upright. */
export type Turn = 0 | 90 | 180 | 270;

export interface UpAccumulator {
  x: number;
  y: number;
}

/** Add this frame's hip-to-shoulder direction (pixels, unit length) to the running sum. */
export function accumulateUp(acc: UpAccumulator, lms: Landmark[] | null, w: number, h: number, minVis: number): void {
  if (!lms) return;
  const ids = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip];
  if (ids.some((i) => (lms[i]?.visibility ?? 0) < minVis)) return;
  const sx = ((lms[LM.leftShoulder].x + lms[LM.rightShoulder].x) / 2) * w;
  const sy = ((lms[LM.leftShoulder].y + lms[LM.rightShoulder].y) / 2) * h;
  const hx = ((lms[LM.leftHip].x + lms[LM.rightHip].x) / 2) * w;
  const hy = ((lms[LM.leftHip].y + lms[LM.rightHip].y) / 2) * h;
  const dx = sx - hx, dy = sy - hy;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return;
  acc.x += dx / len;
  acc.y += dy / len;
}

/** Which way the body points in the image, as the turn that makes it upright. */
export function turnOf(acc: UpAccumulator): Turn {
  if (acc.x === 0 && acc.y === 0) return 0;
  if (Math.abs(acc.x) > Math.abs(acc.y)) return acc.x > 0 ? 90 : 270;
  return acc.y > 0 ? 180 : 0;
}

/** Landmarks in the upright frame (normalized to the upright width and height). */
export function uprightLandmarks(lms: Landmark[], turn: Turn): Landmark[] {
  if (turn === 0) return lms;
  return lms.map((p) => {
    const { x, y } = p;
    const [nx, ny] =
      turn === 180 ? [1 - x, 1 - y] : turn === 90 ? [y, 1 - x] : [1 - y, x];
    return { ...p, x: nx, y: ny };
  });
}

/** Frame size in the upright frame. */
export function uprightSize(w: number, h: number, turn: Turn): { w: number; h: number } {
  return turn === 90 || turn === 270 ? { w: h, h: w } : { w, h };
}
