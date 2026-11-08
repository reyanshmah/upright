import { describe, expect, it } from "vitest";
import { countChairStands, StandStateMachine } from "../lib/signal/chairStand";
import { OneEuroFilter } from "../lib/signal/oneEuro";
import { scoreChairStand, tugAtRisk } from "../lib/signal/thresholds";

describe("CDC chair-stand norms", () => {
  it("uses strict < against the CDC below-average table", () => {
    expect(scoreChairStand(12, false, 72, "female").belowAverage).toBe(false); // < 10
    expect(scoreChairStand(9, false, 72, "female").belowAverage).toBe(true);
    expect(scoreChairStand(13, false, 62, "male").belowAverage).toBe(true); // < 14
    expect(scoreChairStand(14, false, 62, "male").belowAverage).toBe(false);
  });
  it("records 0 if arms were needed", () => {
    const r = scoreChairStand(15, true, 70, "male");
    expect(r.score).toBe(0);
    expect(r.belowAverage).toBe(true);
  });
  it("returns null outside the 60-94 table", () => {
    expect(scoreChairStand(10, false, 55, "female").belowAverage).toBeNull();
    expect(scoreChairStand(10, false, 96, "female").norm).toBeNull();
  });
});

/** Synthetic knee-angle series: n stands, ~30 fps. */
function stands(n: number, fps = 30, cycleS = 2.5) {
  const out: { t: number; kneeDeg: number }[] = [];
  const total = n * cycleS;
  for (let i = 0; i <= total * fps; i++) {
    const t = i / fps;
    const phase = (t % cycleS) / cycleS;
    // seated ~90°, standing ~175°
    const kneeDeg = 132.5 - 42.5 * Math.cos(2 * Math.PI * phase);
    out.push({ t, kneeDeg });
  }
  return out;
}

describe("TUG threshold", () => {
  it("uses >= 12 s, per the CDC STEADI form", () => {
    expect(tugAtRisk(11.99)).toBe(false);
    expect(tugAtRisk(12)).toBe(true);
    expect(tugAtRisk(15)).toBe(true);
  });
});

describe("chair stand counter", () => {
  it("counts synthetic stands", () => {
    expect(countChairStands(stands(8))).toBe(8);
  });

  it("ignores stands after the 30 s window", () => {
    expect(countChairStands(stands(20))).toBe(12);
  });

  it("hysteresis rejects a one-frame spike", () => {
    const sm = new StandStateMachine(3);
    for (let i = 0; i < 5; i++) sm.update(90);
    expect(sm.update(175).stood).toBe(false); // single noisy frame
    for (let i = 0; i < 5; i++) sm.update(90);
    expect(sm.state).toBe("SEATED");
  });
});

describe("One Euro filter", () => {
  it("reduces jitter on a still signal", () => {
    const f = new OneEuroFilter();
    let maxDev = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = 100 + (i % 2 === 0 ? 3 : -3);
      const y = f.filter(noisy, i / 30);
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(y - 100));
    }
    expect(maxDev).toBeLessThan(3);
  });
});

import { wholeBodyVisible } from "../lib/signal/geometry";
describe("whole-body gate", () => {
  const body = (y: number, vis: number) =>
    Array.from({ length: 33 }, () => ({ x: 0.5, y, z: 0, visibility: vis }));
  it("passes when legs are visible and in frame", () => {
    expect(wholeBodyVisible(body(0.7, 0.9), 0.5)).toBe(true);
  });
  it("fails when MediaPipe places legs below the frame, even with high visibility", () => {
    expect(wholeBodyVisible(body(1.6, 0.9), 0.5)).toBe(false);
  });
});

import { missingParts } from "../lib/signal/geometry";
import { StableFlag } from "../lib/signal/gate";
describe("side-view body gate", () => {
  const sideView = () => {
    const b = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.6, z: 0, visibility: 0.95 }));
    // far (right) leg hidden behind the near leg: low visibility
    for (const i of [24, 26, 28]) b[i].visibility = 0.1;
    return b;
  };
  it("passes when only the near leg is visible (side view)", () => {
    expect(missingParts(sideView(), 0.4)).toEqual([]);
  });
  it("names the missing part when feet are below the frame", () => {
    const b = sideView();
    b[27].y = 1.15; // near ankle extrapolated below the image
    expect(missingParts(b, 0.4)).toEqual(["feet"]);
  });
});

describe("StableFlag (gate hysteresis)", () => {
  it("does not flicker on a single bad frame", () => {
    const f = new StableFlag(300, 600);
    let t = 0;
    for (; t <= 400; t += 33) f.update(true, t);
    expect(f.value).toBe(true);
    f.update(false, t); // one bad frame
    t += 33;
    expect(f.update(true, t)).toBe(true);
  });
  it("turns on only after 300 ms of good frames, off after 600 ms of bad", () => {
    const f = new StableFlag(300, 600);
    expect(f.update(true, 0)).toBe(false);
    expect(f.update(true, 200)).toBe(false);
    expect(f.update(true, 310)).toBe(true);
    expect(f.update(false, 400)).toBe(true);
    expect(f.update(false, 900)).toBe(true);
    expect(f.update(false, 1010)).toBe(false);
  });
});
