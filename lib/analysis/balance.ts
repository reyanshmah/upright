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
/**
 * A foot counts as moved only if its SMOOTHED position (median of the last
 * 300 ms) is > 0.25 shank lengths (~10 cm) from where it was at the start of
 * the hold (median of the first 400 ms), and stays that way for 300 ms.
 * Single-frame jitter and brief tracking glitches don't end the hold.
 */
const MOVE_SCALE = 0.25;
const MOVE_MS = 300;
const REF_MS = 400;
const WIN_MS = 300;
const FOOT_VIS = 0.5;
/** Moving within the first second of a hold = still settling in: restart the hold. */
const SETTLE_MS = 1000;
const LOST_MS = 1500;

export interface FrontFeat {
  t: number;
  laVis: number;
  raVis: number;
  la: { x: number; y: number }; // left ankle px (smoothed)
  ra: { x: number; y: number };
  hipMidX: number;
  hipW: number;
  shank: number;
  lateral: number;
  lift: number;
  /** which ankle is higher (lifted) */
  lifted: "left" | "right";
  /**
   * Feet by POSITION, not by MediaPipe's left/right label (which can swap):
   * a = left-most in the image, b = right-most; planted = lower foot, up = higher foot.
   */
  a: { x: number; y: number; vis: number };
  b: { x: number; y: number; vis: number };
  planted: { x: number; y: number; vis: number };
  up: { x: number; y: number; vis: number };
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
    const L = { ...la, vis: lms[LM.leftAnkle].visibility ?? 0 };
    const R = { ...ra, vis: lms[LM.rightAnkle].visibility ?? 0 };
    const [a, b] = L.x <= R.x ? [L, R] : [R, L];
    const [planted, up] = L.y >= R.y ? [L, R] : [R, L];
    return {
      t,
      a,
      b,
      planted,
      up,
      laVis: L.vis,
      raVis: R.vis,
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
  const oneFoot = f.lift > 0.18;
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
  private ref: ReturnType<typeof medianFeet> | null = null;
  private refFrames: FrontFeat[] = [];
  private recent: FrontFeat[] = [];
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
    this.refFrames = [];
    this.recent = [];
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
        this.ref = null;
        this.refFrames = [];
        this.events.push({ t, type: "holdStart", stage: this.stage });
      }
      return this.status;
    }

    // Holding: feet must not move.
    this.heldS = (t - this.holdStartT) / 1000;
    this.swayXs.push(f.hipMidX / f.hipW);
    this.recent.push(f);
    while (this.recent.length && t - this.recent[0].t > WIN_MS) this.recent.shift();

    // Reference = median foot positions over the first 400 ms of the hold.
    if (!this.ref) {
      this.refFrames.push(f);
      if (t - this.holdStartT >= REF_MS) {
        this.ref = medianFeet(this.refFrames);
      }
      if (this.heldS >= HOLD_S) this.end(this.holdStartT + HOLD_S * 1000, true);
      return this.status;
    }

    const r = this.ref;
    const now = medianFeet(this.recent);
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y) / f.shank;
    let moved: boolean;
    if (this.stage === 4) {
      // Planted foot must stay put; the raised foot must not come back down.
      const plantedMoved = f.planted.vis >= FOOT_VIS && dist(now.planted, r.planted) > MOVE_SCALE;
      const down = f.a.vis >= FOOT_VIS && f.b.vis >= FOOT_VIS && now.lift < 0.07;
      moved = plantedMoved || down;
    } else {
      const ma = f.a.vis >= FOOT_VIS ? dist(now.a, r.a) : 0;
      const mb = f.b.vis >= FOOT_VIS ? dist(now.b, r.b) : 0;
      moved = ma > MOVE_SCALE || mb > MOVE_SCALE;
    }
    if (moved) {
      this.movedSince ??= t;
      if (t - this.movedSince >= MOVE_MS) {
        if (this.movedSince - this.holdStartT < SETTLE_MS) {
          // Still settling into the position: restart the hold, don't fail.
          this.holdStartT = t;
          this.heldS = 0;
          this.ref = null;
          this.refFrames = [];
          this.swayXs = [];
          this.movedSince = null;
          this.events.push({ t, type: "holdStart", stage: this.stage });
          return this.status;
        }
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

function medianFeet(fs: FrontFeat[]) {
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const pt = (pick: (f: FrontFeat) => { x: number; y: number }) => ({
    x: med(fs.map((f) => pick(f).x)),
    y: med(fs.map((f) => pick(f).y)),
  });
  const planted = pt((f) => f.planted);
  const up = pt((f) => f.up);
  const shank = med(fs.map((f) => f.shank));
  return { a: pt((f) => f.a), b: pt((f) => f.b), planted, up, lift: Math.abs(planted.y - up.y) / shank };
}

/** CDC: cannot hold tandem (stage 3) for 10 s = increased fall risk. */
export function tandemHeld10(results: StageResult[]): boolean {
  return results.some((r) => r.stage === 3 && r.completed);
}
