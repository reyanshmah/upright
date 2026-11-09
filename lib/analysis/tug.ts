/**
 * Automatic Timed Up and Go.
 *
 * Start = the "Go" cue. End = the moment the person is SEATED again (start of
 * the final seated run) after having walked away and come back. CDC form:
 * "Stop timing after patient sits back down."
 *
 * Distance from the chair is measured as horizontal hip displacement in shank
 * lengths (3 m is ~6-7 shank lengths), so no camera calibration is needed.
 */
import { FeatureExtractor, PostureTracker, classify, type Feat, type Posture } from "./features";

export type TugPhase = "waiting" | "standUp" | "walkOut" | "turn" | "walkBack" | "sitDown" | "done" | "failed";

export interface TugPhases {
  standUp: number;
  walkOut: number;
  turn: number;
  walkBack: number;
  sitDown: number;
}

export interface TugLive {
  phase: TugPhase;
  done: boolean;
  totalS?: number;
  failReason?: "timeout" | "lost" | "notSeatedAtStart";
}

const LEFT_CHAIR = 2.5; // shank lengths (~1.1 m) = they really walked away
const MIN_TURN_D = 3.5; // must get at least this far before a turn counts
const BACK_NEAR = 2.5; // within this of the chair = back at the chair
const TIMEOUT_MS = 90_000;
const LOST_MS = 5_000;

export class TugDetector {
  private posture = new PostureTracker(150);
  private chairX: number | null = null;
  private preSeatedX: number[] = [];
  private sitRunSince: number | null = null;
  private lastSitT = 0;
  private goT: number | null = null;
  private stood = false;
  private maxD = 0;
  private turned = false;
  private lastValidT = 0;
  private recent: { t: number; d: number }[] = [];
  phase: TugPhase = "waiting";
  standT: number | null = null;
  endT: number | null = null;
  readonly feats: { f: Feat; d: number | null; raw: Posture }[] = [];

  setGo(t: number) {
    this.goT = t;
    this.lastValidT = t;
    if (this.preSeatedX.length) {
      const s = [...this.preSeatedX].sort((a, b) => a - b);
      this.chairX = s[Math.floor(s.length / 2)];

    }
    this.phase = "standUp";
  }

  get seatedNow() {
    return this.posture.state === "SEATED";
  }

  push(f: Feat | null, t: number): TugLive {
    if (this.phase === "done" || this.phase === "failed") return this.snapshot();
    if (!f) {
      if (this.goT !== null && t - this.lastValidT > LOST_MS) return this.fail("lost");
      if (this.goT !== null && t - this.goT > TIMEOUT_MS) return this.fail("timeout");
      return this.snapshot();
    }
    this.lastValidT = t;
    const { state, raw } = this.posture.update(f);

    if (this.goT === null) {
      // Before Go: learn where the chair is from seated frames (last ~1 s).
      if (state === "SEATED") {
        this.preSeatedX.push(f.hipX);
        if (this.preSeatedX.length > 45) this.preSeatedX.shift();
      }
      this.feats.push({ f, d: null, raw });
      return this.snapshot();
    }

    if (this.chairX === null) this.chairX = f.hipX;
    const d = Math.abs(f.hipX - this.chairX) / f.shank;
    this.feats.push({ f, d, raw });
    this.recent.push({ t: f.t, d });
    while (this.recent.length && f.t - this.recent[0].t > 400) this.recent.shift();

    if (!this.stood && state === "STANDING") {
      this.stood = true;
      this.standT = this.posture.since;
    }
    // Backup: if they've clearly walked away from the chair, they stood up.
    // Stand time = first frame after Go with the hip clearly raised.
    if (!this.stood && d > 1.5 && raw !== "SEATED") {
      this.stood = true;
      const up = this.feats.find((x) => x.d !== null && x.f.t >= this.goT! && x.f.hipH > 1.5);
      this.standT = up ? up.f.t : f.t;
    }
    this.maxD = Math.max(this.maxD, d);
    if (!this.turned && this.maxD >= MIN_TURN_D && d < this.maxD - 1.0) this.turned = true;

    // Live phase label
    if (!this.stood) this.phase = "standUp";
    else if (!this.turned) {
      const v = this.speed();
      this.phase = this.maxD >= LEFT_CHAIR && d > 0.7 * this.maxD && Math.abs(v) < 0.8 ? "turn" : "walkOut";
    } else this.phase = d < BACK_NEAR ? "sitDown" : "walkBack";

    // End: a NEW sit-down (after standing and turning), back at the chair,
    // held 300 ms. End time = the start of that seated run.
    if (this.stood && this.turned && this.standT !== null) {
      if (raw === "SEATED") {
        if (this.sitRunSince === null || f.t - this.lastSitT > 500) this.sitRunSince = f.t;
        this.lastSitT = f.t;
      } else if (raw === "STANDING") this.sitRunSince = null;
      if (
        this.sitRunSince !== null &&
        this.sitRunSince > this.standT &&
        f.t - this.sitRunSince >= 300 &&
        d < BACK_NEAR + 0.5
      ) {
        this.endT = this.sitRunSince;
        this.phase = "done";
        return this.snapshot();
      }
    }
    if (t - this.goT > TIMEOUT_MS) return this.fail("timeout");
    return this.snapshot();
  }

  /** Displacement speed (shank lengths / s) over the last 400 ms. */
  private speed(): number {
    const r = this.recent;
    if (r.length < 2) return 0;
    const dt = (r[r.length - 1].t - r[0].t) / 1000;
    return dt > 0 ? (r[r.length - 1].d - r[0].d) / dt : 0;
  }

  private fail(reason: TugLive["failReason"]): TugLive {
    this.phase = "failed";
    return { phase: "failed", done: false, failReason: reason };
  }

  private snapshot(): TugLive {
    const done = this.phase === "done" && this.endT !== null && this.goT !== null;
    return {
      phase: this.phase,
      done,
      totalS: done ? (this.endT! - this.goT!) / 1000 : undefined,
    };
  }

  /** Five phases from the recorded series. Null if the boundaries don't line up. */
  phases(): TugPhases | null {
    if (this.goT === null || this.standT === null || this.endT === null) return null;
    const after = this.feats.filter((x) => x.d !== null && x.f.t >= this.goT! && x.f.t <= this.endT!);
    if (after.length < 10) return null;

    // Smoothed velocity of displacement (linear fit over +-250 ms).
    const v = after.map((x, i) => {
      const win = after.filter((y) => Math.abs(y.f.t - x.f.t) <= 250);
      const n = win.length;
      if (n < 3) return 0;
      const mt = win.reduce((a, y) => a + y.f.t, 0) / n;
      const md = win.reduce((a, y) => a + y.d!, 0) / n;
      let num = 0, den = 0;
      for (const y of win) {
        num += (y.f.t - mt) * (y.d! - md);
        den += (y.f.t - mt) ** 2;
      }
      return den > 0 ? (num / den) * 1000 : 0; // per second
      void i;
    });

    let iMax = 0;
    after.forEach((x, i) => {
      if (x.d! > after[iMax].d!) iMax = i;
    });
    const outV = v.slice(0, iMax).filter((x) => x > 0).sort((a, b) => a - b);
    const backV = v.slice(iMax).filter((x) => x < 0).map(Math.abs).sort((a, b) => a - b);
    if (!outV.length || !backV.length) return null;
    const vOut = outV[Math.floor(outV.length * 0.8)];
    const vBack = backV[Math.floor(backV.length * 0.8)];

    let iTurnStart = iMax;
    for (let i = iMax; i >= 0; i--) if (v[i] > 0.3 * vOut) { iTurnStart = i; break; }
    let iTurnEnd = iMax;
    for (let i = iMax; i < after.length; i++) if (v[i] < -0.3 * vBack) { iTurnEnd = i; break; }

    // Sit-down starts when they were last standing.
    let iSit = after.length - 1;
    for (let i = after.length - 1; i > iTurnEnd; i--) if (after[i].raw === "STANDING") { iSit = i; break; }

    const tTS = after[iTurnStart].f.t, tTE = after[iTurnEnd].f.t, tSit = after[iSit].f.t;
    const p: TugPhases = {
      standUp: (this.standT - this.goT) / 1000,
      walkOut: (tTS - this.standT) / 1000,
      turn: (tTE - tTS) / 1000,
      walkBack: (tSit - tTE) / 1000,
      sitDown: (this.endT - tSit) / 1000,
    };
    return Object.values(p).every((x) => x >= 0) ? p : null;
  }
}

export { classify, FeatureExtractor };
