import { describe, expect, it } from "vitest";
import { analyzeChairStand, analyzeTug } from "../lib/analysis";
import { FeatureExtractor, classify, facingCamera } from "../lib/analysis/features";
import type { Landmark } from "../lib/signal/types";
import { lerp, stream } from "./synth";

/**
 * Person FACING the camera in a 1000x1000 image. Shank = 100 px.
 * up = 0 seated (thigh points at the lens, so it looks only 20 px long and the
 * knee looks straight), 1 standing (thigh 100 px, hip 200 px above the ankle).
 * `wide` = shoulders apart (facing the camera); false = shoulders overlap (side-on).
 */
function frontBody(cx: number, up: number, wide = true): Landmark[] {
  const W = 1000;
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x: x / W, y: y / W, z: 0, visibility: 0.95 });
  const hipY = lerp(680, 600, up);
  for (const [side, dx] of [[0, -25], [1, 25]] as const) {
    set(23 + side, cx + dx, hipY);
    set(25 + side, cx + dx, 700);
    set(27 + side, cx + dx, 800);
  }
  const sw = wide ? 60 : 0;
  set(11, cx - sw, hipY - 150);
  set(12, cx + sw, hipY - 150);
  set(15, cx - 20, hipY - 130); // wrists high (arms crossed)
  set(16, cx + 20, hipY - 130);
  set(0, cx, hipY - 220);
  return lm;
}

function featOf(lms: Landmark[]) {
  const fx = new FeatureExtractor(1000, 1000);
  let f = null;
  for (let i = 0; i < 10; i++) f = fx.push(i * 33, lms);
  return f!;
}

describe("facing the camera", () => {
  it("reads a front-on seated person as seated (knee looks straight, thigh looks short)", () => {
    const f = featOf(frontBody(500, 0));
    expect(facingCamera(f)).toBe(true);
    expect(classify(f)).toBe("SEATED");
  });

  it("reads a front-on standing person as standing", () => {
    expect(classify(featOf(frontBody(500, 1)))).toBe("STANDING");
  });

  it("does not apply the short-thigh rule side-on (shoulders overlap)", () => {
    const f = featOf(frontBody(500, 0, false));
    expect(facingCamera(f)).toBe(false);
    expect(classify(f)).not.toBe("SEATED");
  });
});

describe("TUG filmed from the front (walk not visible from the side)", () => {
  // Go at 0.5 s; stand 1.0-1.5 s; walk away and back (barely moves sideways) to 7.0 s; sit 7.0-7.5 s.
  const frontTug = (t: number) => {
    const up = t < 1.0 ? 0 : t < 1.5 ? (t - 1.0) / 0.5 : t < 7.0 ? 1 : t < 7.5 ? 1 - (t - 7.0) / 0.5 : 0;
    const drift = t > 1.5 && t < 7.0 ? 20 * Math.sin(((t - 1.5) / 5.5) * Math.PI) : 0;
    return frontBody(500 + drift, up);
  };

  it("still ends when they sit back down, with a total but no phases (Total only)", () => {
    const r = analyzeTug(stream(frontTug, 10, 0.5));
    expect(r).not.toBeNull();
    expect(r!.totalS).toBeGreaterThan(6.4);
    expect(r!.totalS).toBeLessThan(7.3);
    expect(r!.phases).toBeUndefined();
  });

  it("does not end if they stand and sit straight back down (under the minimum time up)", () => {
    const quick = (t: number) => frontBody(500, t < 1 ? 0 : t < 1.5 ? (t - 1) / 0.5 : t < 2.5 ? 1 : t < 3 ? 1 - (t - 2.5) / 0.5 : 0);
    expect(analyzeTug(stream(quick, 8, 0.5))).toBeNull();
  });
});

describe("chair stand filmed from the front", () => {
  it("counts full stands (one every 2.5 s = 12 in 30 s)", () => {
    // From Go at 0.5 s: rise 0.8 s, stand 0.5 s, sit 0.8 s, rest 0.4 s.
    const cycle = (t: number) => {
      if (t < 0.5) return frontBody(500, 0);
      const u = (t - 0.5) % 2.5;
      const up = u < 0.8 ? u / 0.8 : u < 1.3 ? 1 : u < 2.1 ? 1 - (u - 1.3) / 0.8 : 0;
      return frontBody(500, up);
    };
    const r = analyzeChairStand(stream(cycle, 31, 0.5))!;
    expect(r.count).toBe(12);
    expect(r.armsUsed).toBe(false);
  });
});
