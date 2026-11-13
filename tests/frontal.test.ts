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
 * `seatH` = seated hip height in shank lengths (real recordings: ~1.1-1.4).
 */
function frontBody(cx: number, up: number, wide = true, seatH = 1.2): Landmark[] {
  const W = 1000;
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x: x / W, y: y / W, z: 0, visibility: 0.95 });
  const hipY = lerp(800 - seatH * 100, 600, up);
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

/**
 * Front-on person who walks AWAY from the camera and back: everything shrinks
 * toward the horizon (y = 450) as they get farther. scale 1 = at the chair.
 */
function farBody(scale: number, up: number): Landmark[] {
  // Seated hip at 1.35 shank lengths, close to the 1.45 cutoff, as in the recording.
  return frontBody(500, up, true, 1.35).map((p) => ({
    ...p,
    x: 0.5 + (p.x - 0.5) * scale,
    y: 0.45 + (p.y - 0.45) * scale,
  }));
}

describe("walking toward / away from the camera (real failure, Nov 12 recording)", () => {
  // Go 0.5 s; stand 1.0-1.5; walk away to 55% size by 4.5; stay far (turning, walking) until 6.5;
  // walk back to full size by 8.0 and sit straight down 8.0-8.5, as in the recording.
  const awayBack = (t: number) => {
    const up = t < 1.0 ? 0 : t < 1.5 ? (t - 1.0) / 0.5 : t < 8.0 ? 1 : t < 8.5 ? 1 - (t - 8.0) / 0.5 : 0;
    const scale = t < 1.5 ? 1 : t < 4.5 ? lerp(1, 0.55, (t - 1.5) / 3) : t < 6.5 ? 0.55 : t < 8.0 ? lerp(0.55, 1, (t - 6.5) / 1.5) : 1;
    return farBody(scale, up);
  };

  it("sees the sit-down promptly after walking back (body size estimate keeps up)", () => {
    const r = analyzeTug(stream(awayBack, 12, 0.5));
    expect(r).not.toBeNull();
    // Before the fix the size estimate lagged after walking back and the sit was seen late (8.3 s here, ~2 s late in the recording).
    // True sit (hip below the seated cutoff) is at 8.42 s, Go at 0.5 s: 7.92 s. Within 0.2 s.
    expect(r!.totalS).toBeGreaterThan(7.72);
    expect(r!.totalS).toBeLessThan(8.12);
  });

  it("ignores a brief tiny figure (a pet) while the person is out of view: no fake turn", () => {
    // Person leaves the picture 2.5-4.0 s; a small figure appears at the bottom for 0.25 s at 3.0 s.
    const pet = (t: number): Landmark[] | null => {
      if (t >= 2.5 && t < 4.0) {
        if (t >= 3.0 && t < 3.25) return frontBody(200, 1).map((p) => ({ ...p, x: 0.2 + (p.x - 0.2) * 0.25, y: 0.9 + (p.y - 0.8) * 0.25 }));
        return null;
      }
      return awayBack(t);
    };
    const s = stream((t) => pet(t) ?? frontBody(500, 1), 12, 0.5);
    // Frames where nobody is in view carry no landmarks.
    s.frames.forEach((f) => {
      if (f.t / 1000 >= 2.5 && f.t / 1000 < 4.0 && !(f.t / 1000 >= 3.0 && f.t / 1000 < 3.25)) f.landmarks = null;
    });
    const r = analyzeTug(s);
    expect(r).not.toBeNull();
    // True sit (hip below the seated cutoff) is at 8.42 s, Go at 0.5 s: 7.92 s. Within 0.2 s.
    expect(r!.totalS).toBeGreaterThan(7.72);
    expect(r!.totalS).toBeLessThan(8.12);
    // No lateral walk was filmed, so no phases (Total only) rather than phases built on the pet.
    expect(r!.phases).toBeUndefined();
  });

  it("never treats an impossible 'hip below the knee' detection as seated", () => {
    const f = featOf(frontBody(500, 0));
    expect(classify({ ...f, hipH: 0.46 })).not.toBe("SEATED");
  });
});
