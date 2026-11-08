/**
 * Automatic CDC STEADI 4-Stage Balance Test (front view).
 *
 * CDC form: "If the patient can hold a position for 10 seconds without moving
 * their feet or needing support, go on to the next position. If not, STOP
 * the test." "An older adult who cannot hold the tandem stand for at least
 * 10 seconds is at increased risk of falling." Arms may move; feet may not.
 *
 * Front view geometry (normalized so it works at any distance):
 *   lateral = horizontal ankle separation / hip width
 *   lift    = vertical ankle difference / shank length
 * Feet side by side ~0.3-0.5, semi-tandem ~0.15-0.3, tandem ~0-0.15 hip widths;
 * standing on one foot lifts one ankle well above the other.
 * Stance checks are approximate; if the stance isn't recognized within a
 * grace period the hold starts anyway and is marked unverified.
 */
import { OneEuroFilter } from "../signal/oneEuro";
import { LM, type Landmark } from "../signal/types";

export type Stage = 1 | 2 | 3 | 4;
export const HOLD_S = 10;
const STANCE_STABLE_MS = 800;
const STANCE_GRACE_MS = 15_000;
const MOVE_SCALE = 0.15; // foot moved > 0.15 shank lengths = moved (plan)
const MOVE_MS = 150;
const LOST_MS = 1500;

export interface FrontFeat {
  t: number;
  la: { x: number; y: number }; // left ankle px (smoothed)
  ra: { x: number; y: number };
  hipMidX: number;
  hipW: number;
  shank: number;
  lateral: number;
  lift: number;
  /** which ankle is higher (lifted) */
  lifted: "left" | "right";
}

function usable(p: Landmark | undefined) {
  return !!p && (p.visibility ?? 0) >= 0.3 && p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;
}

export class FrontFeatures {
  private f = {
    lax: new OneEuroFilter({ minCutoff: 1, beta: 0.005, dCutoff: 1 }),
    lay: new OneEuroFilter({ minCutoff: 1, beta: 0.005, dCutoff: 1 }),
    rax: new OneEuroFilter({ minCutoff: 1, beta: 0.005, dCutoff: 1 }),
    ray: new OneEuroFilter({ minCutoff: 1, beta: 0.005, dCutoff: 1 }),
    hx: new OneEuroFilter({ minCutoff: 1, beta: 0.005, dCutoff: 1 }),
  };
  private shanks: number[] = [];
  private hipWs: number[] = [];
  constructor(private w: number, private h: number) {}

  push(t: number, lms: Landmark[] | null): FrontFeat | null {
    if (!lms) return null;
    const need = [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];
    if (!need.every((i) => usable(lms[i]))) return null;
    const W = this.w, H = this.h, s = t / 1000;
    const px = (i: number) => ({ x: lms[i].x * W, y: lms[i].y * H });
    const lk = px(LM.leftKnee), rk = px(LM.rightKnee);
    const la0 = px(LM.leftAnkle), ra0 = px(LM.rightAnkle);
    const lh = px(LM.leftHip), rh = px(LM.rightHip);

    const med = (arr: number[], v: number) => {
      arr.push(v);
      if (arr.length > 90) arr.shift();
      const so = [...arr].sort((a, b) => a - b);
      return so[Math.floor(so.length / 2)];
    };
    const shank = med(this.shanks, (Math.hypot(lk.x - la0.x, lk.y - la0.y) + Math.hypot(rk.x - ra0.x, rk.y - ra0.y)) / 2);
    const hipW = med(this.hipWs, Math.abs(lh.x - rh.x));
    if (shank < 5 || hipW < 3) return null;

    const la = { x: this.f.lax.filter(la0.x, s), y: this.f.lay.filter(la0.y, s) };
    const ra = { x: this.f.rax.filter(ra0.x, s), y: this.f.ray.filter(ra0.y, s) };
    const hipMidX = this.f.hx.filter((lh.x + rh.x) / 2, s);
    return {
      t,
      la,
      ra,
      hipMidX,
      hipW,
      shank,
      lateral: Math.abs(la.x - ra.x) / hipW,
      lift: Math.abs(la.y - ra.y) / shank,
      lifted: la.y < ra.y ? "left" : "right",
    };
  }
}

/** Does this frame look like the stance for this stage? (approximate) */
export function stanceMatches(stage: Stage, f: FrontFeat): boolean {
  const oneFoot = f.lift > 0.25;
  if (stage === 4) return oneFoot;
  if (oneFoot) return false;
  if (stage === 1) return f.lateral >= 0.2;
  if (stage === 2) return f.lateral < 0.4;
  return f.lateral < 0.25; // tandem: feet in line
}

export type StageStatus = "idle" | "waitStance" | "holding" | "held" | "failed" | "lost";

export interface StageResult {
  stage: Stage;
  heldS: number;
  completed: boolean;
  stanceVerified: boolean;
  /** SD of hip-center sideways position during the hold, in hip widths. */
  sway: number | null;
}

export class BalanceDetector {
  stage: Stage = 1;
  status: StageStatus = "idle";
  private stageStartT = 0;
  private stableSince: number | null = null;
  private holdStartT = 0;
  private stanceVerified = false;
  private ref: { la: { x: number; y: number }; ra: { x: number; y: number }; lifted: "left" | "right" } | null = null;
  private movedSince: number | null = null;
  private swayXs: number[] = [];
  private lastFeatT = 0;
  heldS = 0;
  readonly results: StageResult[] = [];
  /** Stage start / hold start times, saved with the recording for replay. */
  readonly events: { t: number; type: "stageStart" | "holdStart" | "stageEnd"; stage: Stage }[] = [];

  startStage(stage: Stage, t: number) {
    this.stage = stage;
    this.status = "waitStance";
    this.stageStartT = t;
    this.stableSince = null;
    this.ref = null;
    this.movedSince = null;
    this.swayXs = [];
    this.heldS = 0;
    this.lastFeatT = t;
    this.events.push({ t, type: "stageStart", stage });
  }

  push(f: FrontFeat | null, t: number): StageStatus {
    if (this.status !== "waitStance" && this.status !== "holding") return this.status;

    if (!f) {
      if (t - this.lastFeatT > LOST_MS) {
        if (this.status === "holding") this.end(t, false);
        else this.status = "lost";
      }
      return this.status;
    }
    this.lastFeatT = t;

    if (this.status === "waitStance") {
      const ok = stanceMatches(this.stage, f);
      if (ok) this.stableSince ??= t;
      else this.stableSince = null;
      const stable = this.stableSince !== null && t - this.stableSince >= STANCE_STABLE_MS;
      const grace = t - this.stageStartT >= STANCE_GRACE_MS;
      if (stable || grace) {
        this.stanceVerified = stable;
        this.status = "holding";
        this.holdStartT = t;
        this.ref = { la: { ...f.la }, ra: { ...f.ra }, lifted: f.lifted };
        this.events.push({ t, type: "holdStart", stage: this.stage });
      }
      return this.status;
    }

    // Holding: feet must not move.
    this.heldS = (t - this.holdStartT) / 1000;
    this.swayXs.push(f.hipMidX / f.hipW);
    const r = this.ref!;
    const dl = Math.hypot(f.la.x - r.la.x, f.la.y - r.la.y) / f.shank;
    const dr = Math.hypot(f.ra.x - r.ra.x, f.ra.y - r.ra.y) / f.shank;
    let moved: boolean;
    if (this.stage === 4) {
      // Standing foot must stay put; the lifted foot must stay up.
      const standing = r.lifted === "left" ? dr : dl;
      moved = standing > MOVE_SCALE || f.lift < 0.12;
    } else {
      moved = dl > MOVE_SCALE || dr > MOVE_SCALE;
    }
    if (moved) {
      this.movedSince ??= t;
      if (t - this.movedSince >= MOVE_MS) {
        this.end(this.movedSince, false);
        return this.status;
      }
    } else this.movedSince = null;

    if (this.heldS >= HOLD_S) this.end(this.holdStartT + HOLD_S * 1000, true);
    return this.status;
  }

  private end(tEnd: number, completed: boolean) {
    const heldS = Math.max(0, Math.min(HOLD_S, (tEnd - this.holdStartT) / 1000));
    const xs = this.swayXs;
    let sway: number | null = null;
    if (xs.length > 5) {
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      sway = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    }
    this.heldS = heldS;
    this.results.push({ stage: this.stage, heldS, completed, stanceVerified: this.stanceVerified, sway });
    this.status = completed ? "held" : "failed";
    this.events.push({ t: tEnd, type: "stageEnd", stage: this.stage });
  }
}

/** CDC: cannot hold tandem (stage 3) for 10 s = increased fall risk. */
export function tandemHeld10(results: StageResult[]): boolean {
  return results.some((r) => r.stage === 3 && r.completed);
}
