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
import { FEATURES, POSTURE } from "../signal/thresholds";

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
  /**
   * Longest visible thigh (hip to knee) in shank lengths, as seen in the
   * picture. About 1 from the side; much shorter when the person faces the
   * camera with the knee bent toward it (sitting). Absent in old recordings.
   */
  thighFrac?: number;
  /**
   * Shoulder width / torso length as seen in the picture: small from the side
   * (shoulders overlap), large when facing the camera. Absent if not visible.
   */
  shoulderFrac?: number;
}

/** The person faces the camera (shoulders look wide). */
export function facingCamera(f: Feat): boolean {
  return f.shoulderFrac !== undefined && f.shoulderFrac > POSTURE.frontalShoulderFrac;
}

/**
 * Knee bent past `deg`, or (facing the camera) bent toward the lens: then the
 * knee looks straight in the picture but the thigh looks very short.
 */
function kneeBent(f: Feat, deg: number): boolean {
  return f.kneeDeg < deg || (facingCamera(f) && f.thighFrac !== undefined && f.thighFrac < POSTURE.frontalThighFrac);
}

export type Posture = "SEATED" | "STANDING" | "BETWEEN";

/**
 * Raw per-frame posture class.
 * Standing uses the straighter knee and hip height above the planted foot, so a
 * walking step (the swing knee bends) still reads as standing.
 */
export function classify(f: Feat): Posture {
  if (kneeBent(f, POSTURE.seatedKneeDeg) && f.hipH < POSTURE.seatedHipH && f.hipH >= POSTURE.seatedMinHipH) return "SEATED";
  if (f.kneeDeg > POSTURE.standingKneeDeg && f.hipH > POSTURE.standingHipH) return "STANDING";
  return "BETWEEN";
}

function usable(p: Landmark | undefined) {
  return !!p && (p.visibility ?? 0) >= FEATURES.minVisibility && p.x > -FEATURES.frameMargin && p.x < 1 + FEATURES.frameMargin && p.y > -FEATURES.frameMargin && p.y < 1 + FEATURES.frameMargin;
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
  private recentShanks: number[] = [];
  /** When frames started looking far too big or small for this person (ms), or null. */
  private jumpSince: number | null = null;
  private fx = new OneEuroFilter(FEATURES.hipXFilter);
  private fhip = new OneEuroFilter(FEATURES.hipHFilter);
  private fknee = new OneEuroFilter(FEATURES.kneeFilter);

  constructor(private w: number, private h: number) {}

  push(t: number, lms: Landmark[] | null): Feat | null {
    if (!lms) return null;
    const W = this.w, H = this.h;
    const legs = LEGS.filter((l) => usable(lms[l.hip]) && usable(lms[l.knee]) && usable(lms[l.ankle]));
    if (!legs.length) return null;

    const lens = legs
      .map((l) => Math.hypot((lms[l.knee].x - lms[l.ankle].x) * W, (lms[l.knee].y - lms[l.ankle].y) * H))
      .filter((len) => len > FEATURES.minShankPx);
    // Several times bigger or smaller than a moment ago: not the same person
    // (e.g. the model latched onto a pet while the person was out of view).
    // Ignore it, unless the new size holds, then the person really moved.
    if (lens.length && this.shanks.length) {
      const ratio = median(lens) / median(this.shanks);
      if (ratio > FEATURES.maxScaleJump || ratio < 1 / FEATURES.maxScaleJump) {
        this.jumpSince ??= t;
        if (t - this.jumpSince < FEATURES.scaleJumpAcceptMs) return null;
        this.shanks = [];
        this.recentShanks = [];
      }
      this.jumpSince = null;
    }
    for (const len of lens) {
      this.shanks.push(len);
      this.recentShanks.push(len);
    }
    while (this.shanks.length > FEATURES.shankWindow) this.shanks.shift();
    while (this.recentShanks.length > FEATURES.shankRecentSamples) this.recentShanks.shift();
    // Walked nearer to / farther from the camera: the long median lags behind
    // the new size, so restart it from the recent samples.
    if (this.shanks.length && this.recentShanks.length >= FEATURES.shankRecentSamples) {
      const ratio = median(this.recentShanks) / median(this.shanks);
      if (Math.abs(ratio - 1) > FEATURES.shankRescaleFrac) this.shanks = [...this.recentShanks];
    }
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
    const thighFrac =
      Math.max(...legs.map((l) => Math.hypot((lms[l.hip].x - lms[l.knee].x) * W, (lms[l.hip].y - lms[l.knee].y) * H))) / shank;

    // Wrists: crossed on the chest = high on the torso; pushing off = low.
    const shY = ((lms[LM.leftShoulder].y + lms[LM.rightShoulder].y) / 2) * H;
    const torso = hipY - shY;
    let wristLow: boolean | null = null;
    for (const wi of [LM.leftWrist, LM.rightWrist]) {
      const wr = lms[wi];
      if (!wr || (wr.visibility ?? 0) < FEATURES.wristMinVisibility || torso <= 0) continue;
      const low = wr.y * H > shY + FEATURES.wristLowTorsoFrac * torso;
      wristLow = wristLow === true ? true : low;
    }

    // Facing the camera or side-on: shoulder width against torso length.
    let shoulderFrac: number | undefined;
    const ls = lms[LM.leftShoulder], rs = lms[LM.rightShoulder];
    if (usable(ls) && usable(rs) && usable(lh) && usable(rh)) {
      const sw = Math.hypot((ls.x - rs.x) * W, (ls.y - rs.y) * H);
      const tl = Math.hypot(((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2) * W, ((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2) * H);
      if (tl > 0) shoulderFrac = sw / tl;
    }

    return { t, hipX, hipH, kneeDeg, shank, wristLow, thighFrac, ...(shoulderFrac !== undefined ? { shoulderFrac } : {}) };
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

  constructor(private holdMs: number = POSTURE.holdMs, private gapMs: number = POSTURE.gapMs) {}

  get seatedBase(): number | null {
    if (this.seatedH.length < POSTURE.seatedBaseMinFrames) return null;
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
      if (this.seatedH.length > POSTURE.seatedBaseWindow) this.seatedH.shift();
      return raw;
    }
    const base = this.seatedBase;
    if (raw === "BETWEEN" && base !== null) {
      if (f.hipH > base + POSTURE.relStandingRiseH && f.kneeDeg > POSTURE.relStandingKneeDeg) return "STANDING";
      if (f.hipH < base + POSTURE.relSeatedRiseH && f.hipH >= POSTURE.seatedMinHipH && kneeBent(f, POSTURE.relSeatedKneeDeg)) return "SEATED";
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
