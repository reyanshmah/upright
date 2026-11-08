import { LM, type Landmark } from "./types";

export type Side = "left" | "right";

/** Angle at b (degrees) formed by a-b-c, in pixel space. */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark, w: number, h: number): number {
  const v1x = (a.x - b.x) * w, v1y = (a.y - b.y) * h;
  const v2x = (c.x - b.x) * w, v2y = (c.y - b.y) * h;
  const dot = v1x * v2x + v1y * v2y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot / n))) * 180) / Math.PI;
}

function legIdx(side: Side) {
  return side === "left"
    ? { hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle }
    : { hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle };
}

/** Side facing the camera = higher mean visibility of hip, knee, ankle. */
export function cameraSide(lms: Landmark[]): Side {
  const vis = (s: Side) => {
    const i = legIdx(s);
    return lms[i.hip].visibility + lms[i.knee].visibility + lms[i.ankle].visibility;
  };
  return vis("left") >= vis("right") ? "left" : "right";
}

export function kneeAngle(lms: Landmark[], side: Side, w: number, h: number): number {
  const i = legIdx(side);
  return angleDeg(lms[i.hip], lms[i.knee], lms[i.ankle], w, h);
}

/** Body scale = average thigh length (hip to knee) in pixels. */
export function bodyScalePx(lms: Landmark[], w: number, h: number): number {
  const thigh = (s: Side) => {
    const i = legIdx(s);
    return Math.hypot((lms[i.hip].x - lms[i.knee].x) * w, (lms[i.hip].y - lms[i.knee].y) * h);
  };
  return (thigh("left") + thigh("right")) / 2;
}

/** Whole-body gate: hips, knees and ankles all above the visibility threshold. */
export function wholeBodyVisible(lms: Landmark[], minVis: number): boolean {
  const idx = [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];
  return idx.every((i) => (lms[i]?.visibility ?? 0) >= minVis);
}
