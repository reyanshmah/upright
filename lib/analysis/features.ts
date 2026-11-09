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
  /** Hip height above the PLANTED (lower) foot, in shank lengths. */
  hipH: number;
  /** Straightest visible knee (the planted leg while walking), smoothed. */
  kneeDeg: number;
  shank: number; // px, rolling median
  /** true = a wrist is low (hands near thighs/chair), false = wrists high on chest, null = no wrist visible */
  wristLow: boolean | null;
}

export type Posture = "SEATED" | "STANDING" | "BETWEEN";

/**
 * Raw per-frame posture class.
 * Standing uses the straighter knee and hip height above the planted foot, so a
 * walking step (the swing knee bends) still reads as standing.
 */
export function classify(f: Feat): Posture {
  if (f.kneeDeg < 125 && f.hipH < 1.45) return "SEATED";
  if (f.kneeDeg > 140 && f.hipH > 1.55) return "STANDING";
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

const LEGS = [
  { hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
  { hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
];

export class FeatureExtractor {
  private shanks: number[] = [];
  private fx = new OneEuroFilter({ minCutoff: 1.5, beta: 0.01, dCutoff: 1 });
  private fhip = new OneEuroFilter({ minCutoff: 1.5, beta: 0.01, dCutoff: 1 });
  private fknee = new OneEuroFilter({ minCutoff: 1.5, beta: 0.02, dCutoff: 1 });

  constructor(private w: number, private h: number) {}

  push(t: number, lms: Landmark[] | null): Feat | null {
    if (!lms) return null;
    const W = this.w, H = this.h;
    const legs = LEGS.filter((l) => usable(lms[l.hip]) && usable(lms[l.knee]) && usable(lms[l.ankle]));
    if (!legs.length) return null;

    for (const l of legs) {
      const k = lms[l.knee], a = lms[l.ankle];
      const len = Math.hypot((k.x - a.x) * W, (k.y - a.y) * H);
      if (len > 5) this.shanks.push(len);
    }
    while (this.shanks.length > 120) this.shanks.shift();
    if (!this.shanks.length) return null;
    const shank = median(this.shanks);

    const lh = lms[LM.leftHip], rh = lms[LM.rightHip];
    const hipY = ((lh.y + rh.y) / 2) * H;
    // Planted foot = the lower ankle in the image.
    const ankleY = Math.max(...legs.map((l) => lms[l.ankle].y * H));
    const kneeRaw = Math.max(...legs.map((l) => angleDeg(lms[l.hip], lms[l.knee], lms[l.ankle], W, H)).filter((x) => !Number.isNaN(x)));
    if (!Number.isFinite(kneeRaw)) return null;

    const ts = t / 1000;
    const hipX = this.fx.filter(((lh.x + rh.x) / 2) * W, ts);
    const hipH = this.fhip.filter((ankleY - hipY) / shank, ts);
    const kneeDeg = this.fknee.filter(kneeRaw, ts);

    // Wrists: crossed on the chest = high on the torso; pushing off = low.
    const shY = ((lms[LM.leftShoulder].y + lms[LM.rightShoulder].y) / 2) * H;
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
 * accepted; `since` is when that run STARTED. In-between frames (e.g. a knee
 * bending mid-step) don't break a run; only the OPPOSITE posture, or more than
 * `gapMs` of in-between frames, does.
 */
export class PostureTracker {
  state: Posture = "BETWEEN";
  since = 0;
  private cand: Posture = "BETWEEN";
  private candSince = 0;
  private lastCandT = 0;
  /** The person's own seated hip height (learned from clearly-seated frames). */
  private seatedH: number[] = [];

  constructor(private holdMs = 150, private gapMs = 500) {}

  get seatedBase(): number | null {
    if (this.seatedH.length < 5) return null;
    const s = [...this.seatedH].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /**
   * Fixed thresholds, plus a person-relative rule: hip clearly above their own
   * seated height with the knee mostly straight = standing. This covers camera
   * angles where a standing hip never reaches the fixed cutoff.
   */
  classify(f: Feat): Posture {
    const raw = classify(f);
    if (raw === "SEATED") {
      this.seatedH.push(f.hipH);
      if (this.seatedH.length > 60) this.seatedH.shift();
      return raw;
    }
    const base = this.seatedBase;
    if (raw === "BETWEEN" && base !== null) {
      if (f.hipH > base + 0.45 && f.kneeDeg > 135) return "STANDING";
      if (f.hipH < base + 0.15 && f.kneeDeg < 130) return "SEATED";
    }
    return raw;
  }

  update(f: Feat): { state: Posture; changed: boolean; raw: Posture } {
    const raw = this.classify(f);
    if (raw === "BETWEEN") {
      if (this.cand !== "BETWEEN" && f.t - this.lastCandT > this.gapMs) this.cand = "BETWEEN";
      return { state: this.state, changed: false, raw };
    }
    if (raw !== this.cand) {
      this.cand = raw;
      this.candSince = f.t;
    }
    this.lastCandT = f.t;
    if (raw !== this.state && f.t - this.candSince >= this.holdMs) {
      this.state = raw;
      this.since = this.candSince;
      return { state: this.state, changed: true, raw };
    }
    return { state: this.state, changed: false, raw };
  }
}
