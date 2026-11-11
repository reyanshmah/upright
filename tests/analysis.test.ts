import { describe, expect, it } from "vitest";
import { analyzeChairStand, analyzeTug } from "../lib/analysis";
import type { Landmark } from "../lib/signal/types";
import { body, chairCycle as cyc, chairPath, lerp, stream, tugPath as tug } from "./synth";

/**
 * Like body(), but while walking the near leg swings: its knee bends to ~120
 * deg and the foot lifts every other step. The far leg is planted and visible.
 */
function walkingBody(ankleX: number, phi: number, t: number, walking: boolean): Landmark[] {
  const lm = body(ankleX, phi);
  const W = 1000;
  const set = (i: number, x: number, y: number, v = 0.9) => (lm[i] = { x: x / W, y: y / W, z: 0, visibility: v });
  // far leg planted, visible
  const hip = { x: lm[23].x * W, y: lm[23].y * W };
  set(24, hip.x, hip.y);
  set(26, ankleX + 5, 700);
  set(28, ankleX + 5, 800);
  if (walking && Math.floor(t * 2) % 2 === 0) {
    // near leg in swing: knee forward and bent, foot lifted
    set(25, ankleX + 45, 690, 0.95);
    set(27, ankleX + 10, 770, 0.95);
  }
  return lm;
}

describe("automatic TUG", () => {
  it("stops itself when they sit back down", () => {
    const r = analyzeTug(stream(tug, 12, 0.5))!;
    expect(r).not.toBeNull();
    // seated classification is reached ~0.7 s into the 1 s sit -> ~10.1 s; minus go 0.5
    expect(r.totalS).toBeGreaterThan(9.3);
    expect(r.totalS).toBeLessThan(9.9);
  });

  it("splits the test into five phases that add up to the total", () => {
    const r = analyzeTug(stream(tug, 12, 0.5))!;
    expect(r.phases).toBeDefined();
    const p = r.phases!;
    const sum = p.standUp + p.walkOut + p.turn + p.walkBack + p.sitDown;
    expect(sum).toBeCloseTo(r.totalS, 1);
    expect(p.standUp).toBeGreaterThan(0.2);
    expect(p.standUp).toBeLessThan(1.2);
    expect(p.turn).toBeGreaterThan(0.6);
    expect(p.turn).toBeLessThan(1.8);
    expect(p.walkOut).toBeGreaterThan(2.5);
    expect(p.walkBack).toBeGreaterThan(2.5);
  });

  it("gets past 'standing up' when the knee bends on every step (real-phone bug)", () => {
    const walkTug = (t: number) => {
      const A = 200;
      let x = A, phi = 90, walking = false;
      if (t < 0.6) phi = 90;
      else if (t < 1.3) phi = lerp(90, 0, (t - 0.6) / 0.7);
      else if (t < 4.7) { phi = 0; walking = true; x = lerp(A, A + 650, (t - 1.3) / 3.4); }
      else if (t < 5.7) { phi = 0; x = A + 650; }
      else if (t < 9.1) { phi = 0; walking = true; x = lerp(A + 650, A, (t - 5.7) / 3.4); }
      else phi = lerp(0, 90, (t - 9.1) / 1.0);
      return walkingBody(x, phi, t, walking);
    };
    const r = analyzeTug(stream(walkTug, 12, 0.5))!;
    expect(r).not.toBeNull();
    expect(r.totalS).toBeGreaterThan(9.0);
    expect(r.totalS).toBeLessThan(9.6);
    expect(r.phases).toBeDefined();
  });

  it("detects standing up even when the camera angle makes the hip look low (stuck-on-standing bug)", () => {
    // Phone above hip height: the thigh looks short, so standing hip height only reaches
    // 1.5 shank lengths, below the fixed 1.55 cutoff. The person-relative rule must catch it.
    const lowHip = (t: number) => {
      const A = 200;
      let x = A, phi = 90;
      if (t < 0.6) phi = 90;
      else if (t < 1.6) phi = lerp(90, 0, (t - 0.6) / 1.0);
      else if (t < 5.0) { phi = 0; x = lerp(A, A + 650, (t - 1.6) / 3.4); }
      else if (t < 6.0) { phi = 0; x = A + 650; }
      else if (t < 9.4) { phi = 0; x = lerp(A + 650, A, (t - 6.0) / 3.4); }
      else phi = lerp(0, 90, (t - 9.4) / 1.0);
      return body(x, phi, false, 50);
    };
    const r = analyzeTug(stream(lowHip, 12, 0.5))!;
    expect(r).not.toBeNull();
    expect(r.totalS).toBeGreaterThan(9.2);
    expect(r.totalS).toBeLessThan(10.0);
    // stand-up found from the hip rising, not late from walking away
    expect(r.phases?.standUp ?? 99).toBeLessThan(1.2);
  });

  it("does not end early if they just stand and sit without walking away", () => {
    const s = (t: number) => body(200, t < 1 ? 90 : t < 2 ? lerp(90, 0, t - 1) : t < 3 ? lerp(0, 90, t - 2) : 90);
    expect(analyzeTug(stream(s, 8, 0.5))).toBeNull();
  });

  it("is about 2x slower for a 2x slower walker", () => {
    const slow = (t: number) => tug(t / 2);
    const fast = analyzeTug(stream(tug, 12, 0))!;
    const r = analyzeTug(stream(slow, 24, 0))!;
    expect(r.totalS / fast.totalS).toBeGreaterThan(1.8);
    expect(r.totalS / fast.totalS).toBeLessThan(2.2);
  });
});

describe("automatic 30-Second Chair Stand", () => {
  const chair = chairPath;

  it("counts full stands in 30 s", () => {
    const r = analyzeChairStand(stream(chair(), 31, 0.5))!;
    expect(r.count).toBe(12);
    expect(r.armsUsed).toBe(false);
  });

  it("counts a stand that is more than halfway up at 30 s", () => {
    // 11 full cycles, then a slow final rise that is ~70% up at 30 s
    const s = (t: number) => {
      const g = t - 0.5;
      if (g < 0) return body(300, 90);
      if (g < 27.5) return body(300, cyc(g % 2.5));
      if (g < 28.5) return body(300, 90);
      // at g=30: thigh at ~52 deg -> hip height ~1.6 shanks (past halfway between seated 1.0 and
      // standing 2.0) with the knee still bent ~128 deg, so not yet a full stand
      return body(300, lerp(90, 0, (g - 28.5) / 3.6));
    };
    const r = analyzeChairStand(stream(s, 30.5, 0.5))!;
    expect(r.count).toBe(12);
    expect(r.halfwayCounted).toBe(true);
  });

  it("detects arms used to push up", () => {
    const r = analyzeChairStand(stream(chair(true), 31, 0.5))!;
    expect(r.armsUsed).toBe(true);
  });
});
