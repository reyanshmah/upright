/**
 * Automatic 30-Second Chair Stand (CDC STEADI form rules):
 * - count each time they come to a FULL standing position within 30 s
 * - "If the patient is over halfway to a standing position when 30 seconds
 *   have elapsed, count it as a stand."
 * - "If the patient must use his/her arms to stand, stop the test. Record 0."
 *   Arms crossed on the chest keep the wrists high on the torso; pushing off
 *   moves a wrist down to the thighs/seat during a rise.
 */
import { PostureTracker, type Feat } from "./features";
import { ALGO } from "../signal/thresholds";

export interface ChairLive {
  count: number;
  armsUsed: boolean;
  done: boolean;
  remainingS: number;
  halfwayCounted: boolean;
}

const ARMS_MS = 200;

export class ChairDetector {
  private posture = new PostureTracker(100);
  private goT: number | null = null;
  count = 0;
  armsUsed = false;
  halfwayCounted = false;
  done = false;
  private seatedH: number[] = [];
  private standingH: number[] = [];
  private lastFeat: Feat | null = null;
  private armsLowSince: number | null = null;

  setGo(t: number) {
    this.goT = t;
  }

  get seatedNow() {
    return this.posture.state === "SEATED";
  }

  push(f: Feat | null, t: number): ChairLive {
    if (this.done || this.goT === null) {
      if (f && this.goT === null) this.posture.update(f);
      return this.snapshot(t);
    }
    const elapsed = t - this.goT;
    if (elapsed >= ALGO.chairStandWindowS * 1000) return this.finish(t);
    if (!f) return this.snapshot(t);

    this.lastFeat = f;
    const { state, changed, raw } = this.posture.update(f);
    // Reference heights from clearly-seated / clearly-standing frames only.
    if (raw === "SEATED") this.seatedH.push(f.hipH);
    if (raw === "STANDING") this.standingH.push(f.hipH);
    if (changed && state === "STANDING" && this.posture.since >= this.goT) this.count++;

    // Arm use: a wrist low on the body while rising (not yet standing).
    const rising = state === "SEATED" && f.hipH > this.midH() - 0.25;
    if ((rising || state === "BETWEEN") && f.wristLow === true) {
      this.armsLowSince ??= f.t;
      if (f.t - this.armsLowSince >= ARMS_MS) this.armsUsed = true;
    } else this.armsLowSince = null;

    return this.snapshot(t);
  }

  private midH(): number {
    const med = (xs: number[], d: number) => {
      if (!xs.length) return d;
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    return (med(this.seatedH, 1.15) + med(this.standingH, 1.95)) / 2;
  }

  private finish(t: number): ChairLive {
    if (!this.done) {
      this.done = true;
      // Halfway rule: mid-rise and more than halfway up at 30 s.
      const f = this.lastFeat;
      if (f && this.posture.state === "SEATED" && f.hipH > this.midH()) {
        this.count++;
        this.halfwayCounted = true;
      }
    }
    return this.snapshot(t);
  }

  private snapshot(t: number): ChairLive {
    const remaining = this.goT === null ? ALGO.chairStandWindowS : Math.max(0, ALGO.chairStandWindowS - (t - this.goT) / 1000);
    return {
      count: this.count,
      armsUsed: this.armsUsed,
      done: this.done,
      remainingS: remaining,
      halfwayCounted: this.halfwayCounted,
    };
  }
}
