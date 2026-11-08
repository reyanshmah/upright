import { describe, expect, it } from "vitest";
import { BalanceDetector, FrontFeatures, stanceMatches, tandemHeld10, type Stage } from "../lib/analysis/balance";
import type { Landmark } from "../lib/signal/types";

/** Front-view person in a 1000x1000 frame. Hip width 100 px, shank 100 px. */
function front(laX: number, raX: number, rLift = 0, sway = 0): Landmark[] {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, z: 0, visibility: 0.95 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x: x / 1000, y: y / 1000, z: 0, visibility: 0.95 });
  set(23, 550 + sway, 500); // left hip (person's left = image right in a front view)
  set(24, 450 + sway, 500);
  set(25, laX, 650);
  set(26, raX, 650 - rLift);
  set(27, laX, 750);
  set(28, raX, 750 - rLift);
  return lm;
}

const STANCE = {
  1: () => front(540, 460),
  2: () => front(515, 485),
  3: () => front(503, 497),
  4: () => front(510, 490, 45),
} as const;

function run(
  stage: Stage,
  frameAt: (t: number) => Landmark[],
  seconds: number,
) {
  const fx = new FrontFeatures(1000, 1000);
  const det = new BalanceDetector();
  det.startStage(stage, 0);
  for (let i = 0; i <= seconds * 30; i++) {
    const t = (i / 30) * 1000;
    const s = det.push(fx.push(t, frameAt(t / 1000)), t);
    if (s === "held" || s === "failed") break;
  }
  return det;
}

describe("balance stance recognition", () => {
  it("recognizes each CDC stance", () => {
    for (const s of [1, 2, 3, 4] as Stage[]) {
      const fx = new FrontFeatures(1000, 1000);
      let f = null;
      for (let i = 0; i < 10; i++) f = fx.push(i * 33, STANCE[s]());
      expect(stanceMatches(s, f!)).toBe(true);
    }
  });
  it("doesn't accept feet apart as tandem, or two feet as one-foot", () => {
    const fx = new FrontFeatures(1000, 1000);
    let f = null;
    for (let i = 0; i < 10; i++) f = fx.push(i * 33, STANCE[1]());
    expect(stanceMatches(3, f!)).toBe(false);
    expect(stanceMatches(4, f!)).toBe(false);
  });
});

describe("balance holds", () => {
  it("completes a steady 10 s hold (with arm/body sway allowed)", () => {
    const det = run(1, (t) => front(540, 460, 0, Math.sin(t * 3) * 6), 14);
    expect(det.status).toBe("held");
    expect(det.results[0].heldS).toBe(10);
    expect(det.results[0].stanceVerified).toBe(true);
    expect(det.results[0].sway).toBeGreaterThan(0);
  });

  it("ends tandem when a foot steps out at ~6 s into the hold", () => {
    // stance recognized after ~0.8 s, so the hold starts ~0.8 s in
    const det = run(3, (t) => (t < 6.8 ? STANCE[3]() : front(503, 440)), 14);
    expect(det.status).toBe("failed");
    expect(det.results[0].heldS).toBeGreaterThan(5.6);
    expect(det.results[0].heldS).toBeLessThan(6.4);
    expect(tandemHeld10(det.results)).toBe(false);
  });

  it("ends one-foot stance when the lifted foot touches down", () => {
    const det = run(4, (t) => (t < 4.8 ? STANCE[4]() : front(510, 490, 0)), 14);
    expect(det.status).toBe("failed");
    expect(det.results[0].heldS).toBeGreaterThan(3.6);
    expect(det.results[0].heldS).toBeLessThan(4.4);
  });

  it("starts the hold anyway after 15 s if the stance isn't recognized, marked unverified", () => {
    const det = run(3, () => STANCE[1](), 30);
    expect(det.results[0].stanceVerified).toBe(false);
  });

  it("tandem held 10 s = not at risk", () => {
    const det = run(3, () => STANCE[3](), 14);
    expect(tandemHeld10(det.results)).toBe(true);
  });
});
