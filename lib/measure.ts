/**
 * Measuring floor distance with the pose model (side view).
 *
 * Idea: if the person walks along a line parallel to the camera's image
 * plane, they stay at roughly the same depth, so one pixels-per-meter scale
 * applies everywhere along the line. We get that scale from the person's
 * known height: the eye-to-heel distance in pixels vs. their eye height in
 * meters.
 *
 * Eye height ~= 0.936 x standing height (Drillis & Contini anthropometric
 * segment proportions). APPROXIMATION: validate against a tape measure and
 * report the error before claiming accuracy.
 */
import type { Landmark } from "./signal/types";

export const EYE_HEIGHT_RATIO = 0.936;

const L_EYE = 2, R_EYE = 5, L_HEEL = 29, R_HEEL = 30, L_ANKLE = 27, R_ANKLE = 28;

function mid(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function inFrame(p: Landmark, m = 0.01) {
  return p.x >= m && p.x <= 1 - m && p.y >= m && p.y <= 1 - m;
}

/** Eyes and heels visible and inside the frame (needed for the scale). */
export function measurable(lms: Landmark[], minVis = 0.5): boolean {
  return [L_EYE, R_EYE, L_HEEL, R_HEEL, L_ANKLE, R_ANKLE].every(
    (i) => (lms[i]?.visibility ?? 0) >= minVis && inFrame(lms[i]),
  );
}

/** Pixels per meter from one standing frame. */
export function pixelsPerMeter(lms: Landmark[], w: number, h: number, heightCm: number): number {
  const eye = mid(lms[L_EYE], lms[R_EYE]);
  const heel = mid(lms[L_HEEL], lms[R_HEEL]);
  const px = Math.hypot((heel.x - eye.x) * w, (heel.y - eye.y) * h);
  return px / ((heightCm / 100) * EYE_HEIGHT_RATIO);
}

/** Horizontal foot position in pixels (mid-ankle). */
export function footX(lms: Landmark[], w: number): number {
  return ((lms[L_ANKLE].x + lms[R_ANKLE].x) / 2) * w;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Distance walked (meters) from the start foot position. */
export function distanceM(startX: number, nowX: number, ppm: number): number {
  return Math.abs(nowX - startX) / ppm;
}

export const TARGET_M = 3;
export const TOLERANCE_M = 0.05;

export function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1} ft 0 in` : `${ft} ft ${inch} in`;
}
