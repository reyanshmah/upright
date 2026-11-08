import { describe, expect, it } from "vitest";
import { analyzeChairStand, analyzeTug } from "../lib/analysis";
import type { Landmark, LandmarkStream, PoseFrame } from "../lib/signal/types";

/**
 * Synthetic side-view person in a 1000x1000 image.
 * Shank = thigh = 100 px. phi = thigh angle from vertical (0 standing, 90 seated).
 */
function body(ankleX: number, phi: number, armsLow = false): Landmark[] {
  const W = 1000;
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
  const set = (i: number, x: number, y: number, v = 0.95) => (lm[i] = { x: x / W, y: y / W, z: 0, visibility: v });
  const r = (phi * Math.PI) / 180;
  const ankle = { x: ankleX, y: 800 };
  const knee = { x: ankleX, y: 700 };
  const hip = { x: knee.x - 100 * Math.sin(r), y: knee.y - 100 * Math.cos(r) };
  for (const [i, v] of [[23, 0.95], [24, 0.6]] as const) set(i, hip.x, hip.y, v);
  for (const [i, v] of [[25, 0.95], [26, 0.2]] as const) set(i, knee.x, knee.y, v);
  for (const [i, v] of [[27, 0.95], [28, 0.2]] as const) set(i, ankle.x, ankle.y, v);
  set(11, hip.x, hip.y - 150);
  set(12, hip.x, hip.y - 150);
  const wy = armsLow ? hip.y + 10 : hip.y - 130;
  set(15, hip.x + 20, wy);
  set(16, hip.x + 20, wy, 0.3);
  set(0, hip.x, hip.y - 220);
  return lm;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.max(0, Math.min(1, u));

function stream(fn: (t: number) => Landmark[], untilS: number, goS: number, fps = 30): LandmarkStream {
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= untilS * fps; i++) {
    const t = (i / fps) * 1000;
    // small tracking noise
    const lms = fn(t / 1000).map((p) => ({ ...p, x: p.x + (Math.sin(i * 7.3) * 0.0015), y: p.y + Math.cos(i * 5.1) * 0.0015 }));
    frames.push({ t, landmarks: lms });
  }
  return { version: 1, sessionId: "test", goCueT: goS * 1000, videoWidth: 1000, videoHeight: 1000, frames };
}

describe("automatic TUG", () => {
  // go 0.5 | stand 0.6-1.6 | walk out 1.6-5.0 (650 px = 6.5 shanks) | turn 5.0-6.0 | back 6.0-9.4 | sit 9.4-10.4
  const tug = (t: number) => {
    const A = 200;
    let x = A, phi = 90;
    if (t < 0.6) phi = 90;
    else if (t < 1.6) phi = lerp(90, 0, (t - 0.6) / 1.0);
    else if (t < 5.0) { phi = 0; x = lerp(A, A + 650, (t - 1.6) / 3.4); }
    else if (t < 6.0) { phi = 0; x = A + 650; }
    else if (t < 9.4) { phi = 0; x = lerp(A + 650, A, (t - 6.0) / 3.4); }
    else phi = lerp(0, 90, (t - 9.4) / 1.0);
    return body(x, phi);
  };

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
  // cycle 2.5 s: rise 0.8, stand 0.4, sit 0.8, seated 0.5
  const cyc = (u: number) => (u < 0.8 ? lerp(90, 0, u / 0.8) : u < 1.2 ? 0 : u < 2.0 ? lerp(0, 90, (u - 1.2) / 0.8) : 90);
  const chair = (armsLow = false) => (t: number) => {
    const u = t < 0.5 ? 2.4 : (t - 0.5) % 2.5;
    const phi = cyc(u);
    return body(300, phi, armsLow && phi > 20 && phi < 85 && u < 0.8);
  };

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
      return body(300, lerp(90, 0, (g - 28.5) / 2.2)); // at g=30 -> ~68% up
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
