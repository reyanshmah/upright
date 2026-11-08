import { ALGO } from "./thresholds";

export type PoseState = "SEATED" | "STANDING" | "BETWEEN";

/**
 * SEATED / STANDING state machine with hysteresis. A candidate state must hold
 * `holdFrames` consecutive frames before it becomes the current state, so one
 * noisy frame can never add or drop a stand.
 */
export class StandStateMachine {
  state: PoseState = "BETWEEN";
  private candidate: PoseState = "BETWEEN";
  private run = 0;

  constructor(private holdFrames: number = ALGO.holdFrames) {}

  static classify(kneeDeg: number): PoseState {
    if (Number.isNaN(kneeDeg)) return "BETWEEN";
    if (kneeDeg < ALGO.seatedKneeDeg) return "SEATED";
    if (kneeDeg > ALGO.standingKneeDeg) return "STANDING";
    return "BETWEEN";
  }

  /** Feed one frame; returns true when a SEATED -> STANDING transition completes. */
  update(kneeDeg: number): { state: PoseState; stood: boolean } {
    const c = StandStateMachine.classify(kneeDeg);
    if (c === "BETWEEN") return { state: this.state, stood: false };
    if (c === this.candidate) this.run++;
    else {
      this.candidate = c;
      this.run = 1;
    }
    let stood = false;
    if (this.run >= this.holdFrames && c !== this.state) {
      if (this.state === "SEATED" && c === "STANDING") stood = true;
      this.state = c;
    }
    return { state: this.state, stood };
  }
}

export interface KneeSample {
  /** Seconds since the go cue. */
  t: number;
  kneeDeg: number;
}

/**
 * Count full stands inside the 30 s window. Pure function of the knee-angle
 * series so it can be re-scored on saved streams.
 *
 * TODO: STEADI's "more than halfway up at 30 s counts" rule. Needs the
 * halfway knee angle defined from each participant's seated/standing baseline.
 */
export function countChairStands(samples: KneeSample[], holdFrames: number = ALGO.holdFrames): number {
  const sm = new StandStateMachine(holdFrames);
  let count = 0;
  for (const s of samples) {
    if (s.t < 0 || s.t > ALGO.chairStandWindowS) continue;
    if (sm.update(s.kneeDeg).stood) count++;
  }
  return count;
}
