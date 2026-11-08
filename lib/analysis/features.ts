/**
 * Per-frame features for the automatic tests, from MediaPipe landmarks.
 *
 * Everything is normalized by SHANK length (knee to ankle, in pixels), which
 * stays the same whether the person is sitting, standing or walking in a side
 * view, so thresholds work at any camera distance.
 *
 *   hipH = (ankle y - hip y) / shank
 *     seated   ~ 1.0-1.3  (hip roughly at knee height on a 17" seat)
 *     standing ~ 1.8-2.1  (thigh + shank)
 */
import { OneEuroFilter } from "../signal/oneEuro";
import { angleDeg } from "../signal/geometry";
import { LM, type Landmark } from "../signal/types";

export interface Feat {
  t: number; // ms (performance.now)
  hipX: number; // px, smoothed
  hipH: number; // hip height above ankle, in shank lengths
  kneeDeg: number; // smoothed knee angle (near leg)
  shank: number; // px, rolling median
  /** true = a wrist is low (hands near thighs/chair), false = wrists high on chest, null = no wrist visible */
  wristLow: boolean | null;
}

export type Posture = "SEATED" | "STANDING" | "BETWEEN";

/** Raw per-frame posture class. Both knee angle and hip height must agree. */
export function classify(f: Feat): Posture {
  if (f.kneeDeg < 125 && f.hipH < 1.45) return "SEATED";
  if (f.kneeDeg > 145 && f.hipH > 1.6) return "STANDING";
  return "BETWEEN";
}

const MIN_VIS = 0.3;

function usable(p: Landmark | undefined) {
  return !!p && (p.visibility ?? 0) >= MIN_VIS && p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export class FeatureExtractor {
  private side: "left" | "right" | null = null;
  private shanks: number[] = [];
  private fx = new OneEuroFilter({ minCutoff: 1.5, beta: 0.01, dCutoff: 1 });
  private fhip = new OneEuroFilter({ minCutoff: 1.5, beta: 0.01, dCutoff: 1 });
  private fknee = new OneEuroFilter({ minCutoff: 1.5, beta: 0.02, dCutoff: 1 });

  constructor(private w: number, private h: number) {}

  push(t: number, lms: Landmark[] | null): Feat | null {
    if (!lms) return null;
    const vis = (s: "left" | "right") => {
      const i = s === "left" ? [LM.leftHip, LM.leftKnee, LM.leftAnkle] : [LM.rightHip, LM.rightKnee, LM.rightAnkle];
      return i.reduce((a, k) => a + (lms[k]?.visibility ?? 0), 0);
    };
    // Near leg = more visible. Only switch sides on a clear difference.
    const l = vis("left"), r = vis("right");
    if (!this.side) this.side = l >= r ? "left" : "right";
    else if (this.side === "left" && r > l + 0.4) this.side = "right";
    else if (this.side === "right" && l > r + 0.4) this.side = "left";

    const s = this.side;
    const hip = lms[s === "left" ? LM.leftHip : LM.rightHip];
    const knee = lms[s === "left" ? LM.leftKnee : LM.rightKnee];
    const ankle = lms[s === "left" ? LM.leftAnkle : LM.rightAnkle];
    if (!usable(hip) || !usable(knee) || !usable(ankle)) return null;

    const W = this.w, H = this.h;
    const shankNow = Math.hypot((knee.x - ankle.x) * W, (knee.y - ankle.y) * H);
    if (shankNow < 5) return null;
    this.shanks.push(shankNow);
    if (this.shanks.length > 90) this.shanks.shift();
    const shank = median(this.shanks);

    // Hip x: average both hips (they overlap in a side view) for stability.
    const lh = lms[LM.leftHip], rh = lms[LM.rightHip];
    const hipXraw = ((lh.x + rh.x) / 2) * W;
    const ts = t / 1000;
    const hipX = this.fx.filter(hipXraw, ts);
    const hipHraw = ((ankle.y - hip.y) * H) / shank;
    const hipH = this.fhip.filter(hipHraw, ts);
    const kneeRaw = angleDeg(hip, knee, ankle, W, H);
    const kneeDeg = Number.isNaN(kneeRaw) ? NaN : this.fknee.filter(kneeRaw, ts);

    // Wrists: crossed on the chest = high on the torso; pushing off = low.
    const shY = ((lms[LM.leftShoulder].y + lms[LM.rightShoulder].y) / 2) * H;
    const hipY = ((lh.y + rh.y) / 2) * H;
    const torso = hipY - shY;
    let wristLow: boolean | null = null;
    for (const wi of [LM.leftWrist, LM.rightWrist]) {
      const wr = lms[wi];
      if (!wr || (wr.visibility ?? 0) < 0.4 || torso <= 0) continue;
      const low = wr.y * H > shY + 0.65 * torso;
      wristLow = wristLow === true ? true : low;
    }

    return { t, hipX, hipH, kneeDeg, shank, wristLow };
  }
}

/**
 * Posture with time hysteresis. A new posture must hold `holdMs` before it is
 * accepted; `since` is when that run STARTED, so event times aren't delayed by
 * the hold. BETWEEN frames never change the state.
 */
export class PostureTracker {
  state: Posture = "BETWEEN";
  since = 0;
  private cand: Posture = "BETWEEN";
  private candSince = 0;

  constructor(private holdMs = 150) {}

  update(f: Feat): { state: Posture; changed: boolean; raw: Posture } {
    const raw = classify(f);
    if (raw === "BETWEEN") {
      this.cand = "BETWEEN";
      return { state: this.state, changed: false, raw };
    }
    if (raw !== this.cand) {
      this.cand = raw;
      this.candSince = f.t;
    }
    if (raw !== this.state && f.t - this.candSince >= this.holdMs) {
      this.state = raw;
      this.since = this.candSince;
      return { state: this.state, changed: true, raw };
    }
    return { state: this.state, changed: false, raw };
  }
}
