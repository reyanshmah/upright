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

describe("balance holds don't end from camera jitter (real-phone bug)", () => {
  // Deterministic pseudo-random jitter
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

  const jittery = (base: Landmark[], t: number) =>
    base.map((p, i) => {
      if (i !== 27 && i !== 28) return p;
      const glitch = Math.floor(t * 30) % 47 === 0; // occasional one-frame glitch
      const j = glitch ? 0.045 : 0.008; // 45 px spike vs normal ~8 px jitter (shank = 100 px)
      return { ...p, x: p.x + rnd() * j, y: p.y + rnd() * j, visibility: glitch ? 0.35 : p.visibility };
    });

  it("tandem: holds the full 10 s with jitter and glitches", () => {
    const det = run(3, (t) => jittery(STANCE[3](), t), 14);
    expect(det.results[0].completed).toBe(true);
    expect(det.results[0].heldS).toBe(10);
  });

  it("one foot: holds the full 10 s when the lifted foot dips but doesn't touch down", () => {
    // lift starts at 45 px (0.45 shank), sways down to ~22 px and back
    const dip = (t: number) => jittery(front(510, 490, 34 + 11 * Math.cos(t * 2)), t);
    const det = run(4, dip, 14);
    expect(det.results[0].completed).toBe(true);
  });

  it("still catches a real step out of tandem", () => {
    const det = run(3, (t) => jittery(t < 6.8 ? STANCE[3]() : front(503, 440), t), 14);
    expect(det.results[0].completed).toBe(false);
    expect(det.results[0].heldS).toBeGreaterThan(5.6);
    expect(det.results[0].heldS).toBeLessThan(6.6);
  });
});

describe("balance: camera swaps left/right foot labels (real-phone bug)", () => {
  // MediaPipe sometimes swaps which ankle is 'left' vs 'right' for a while.
  const swapAt = (lms: Landmark[], swapped: boolean) => {
    if (!swapped) return lms;
    const c = lms.map((p) => ({ ...p }));
    for (const [a, b] of [[25, 26], [27, 28]]) [c[a], c[b]] = [c[b], c[a]];
    return c;
  };
  const swaps = (t: number) => (t > 3 && t < 3.5) || (t > 6 && t < 7.2) || (t > 9 && t < 9.4);

  it("feet side by side: label swaps don't count as moving", () => {
    const det = run(1, (t) => swapAt(STANCE[1](), swaps(t)), 14);
    expect(det.results[0].completed).toBe(true);
  });

  it("one foot: label swaps don't count as the foot touching down", () => {
    const det = run(4, (t) => swapAt(STANCE[4](), swaps(t)), 14);
    expect(det.results[0].completed).toBe(true);
  });

  it("settling in the first second restarts the hold instead of failing", () => {
    // shuffles the back foot 15 px at 1.2 s (just after the hold starts), then stays still
    const det = run(3, (t) => (t < 1.2 ? front(503, 497) : front(503, 470)), 16);
    expect(det.results[0].completed).toBe(true);
  });
});

describe("balance: the person holding the phone can move a little (Nov 14)", () => {
  /** Moves the whole picture: shift (px), zoom about the centre, and tilt (deg). */
  const camera = (lms: Landmark[], dx: number, dy: number, zoom = 1, rollDeg = 0) => {
    const r = (rollDeg * Math.PI) / 180;
    return lms.map((p) => {
      const x = (p.x - 0.5) * zoom, y = (p.y - 0.5) * zoom;
      return {
        ...p,
        x: 0.5 + x * Math.cos(r) - y * Math.sin(r) + dx / 1000,
        y: 0.5 + x * Math.sin(r) + y * Math.cos(r) + dy / 1000,
      };
    });
  };
  // Hand-held drift: slow sideways/up-down wander, a slight zoom and tilt.
  const handheld = (t: number) => ({
    dx: 60 * Math.sin(t * 0.9) + 8 * Math.sin(t * 7),
    dy: 25 * Math.sin(t * 1.3),
    zoom: 1 + 0.12 * Math.sin(t * 0.5),
    roll: 6 * Math.sin(t * 0.7),
  });

  for (const stage of [1, 2, 3, 4] as Stage[]) {
    it(`position ${stage}: completes the 10 s hold while the phone drifts, zooms and tilts`, () => {
      const det = run(stage, (t) => {
        const c = handheld(t);
        return camera(STANCE[stage](), c.dx, c.dy, c.zoom, c.roll);
      }, 16);
      expect(det.results[0].completed).toBe(true);
      expect(det.results[0].heldS).toBe(10);
    });
  }

  it("a quick 4 cm wiggle of one foot doesn't end the hold", () => {
    // back foot slides 10 px (~4 cm) for half a second, then returns
    const det = run(3, (t) => (t > 5 && t < 5.5 ? front(503, 487) : STANCE[3]()), 14);
    expect(det.results[0].completed).toBe(true);
  });

  it("still catches a small real step (~14 cm) even while the phone moves", () => {
    const det = run(3, (t) => {
      const c = handheld(t);
      return camera(t < 6.8 ? STANCE[3]() : front(503, 462), c.dx, c.dy, c.zoom, c.roll);
    }, 14);
    expect(det.results[0].completed).toBe(false);
    expect(det.results[0].heldS).toBeGreaterThan(5.5);
    expect(det.results[0].heldS).toBeLessThan(6.6);
  });

  it("feet out of view mid-hold = couldn't measure, not a balance failure", () => {
    const fx = new FrontFeatures(1000, 1000);
    const det = new BalanceDetector();
    det.startStage(3, 0);
    for (let i = 0; i <= 14 * 30; i++) {
      const t = (i / 30) * 1000;
      const lms = t > 5000 ? null : STANCE[3]();
      det.push(lms ? fx.push(t, lms) : null, t);
    }
    expect(det.status).toBe("lost");
    expect(det.results.length).toBe(0);
  });
});

describe("balance: full 4-position run filmed from 45 degrees (Nov 14 placement)", () => {
  // Feet in the person's own frame (px; 100 px = shank ~40 cm): x = sideways, z = forward.
  type Feet = { lx: number; lz: number; rx: number; rz: number; lift: number };
  const POS: Record<Stage, Feet> = {
    1: { lx: 40, lz: 0, rx: -40, rz: 0, lift: 0 }, // side by side
    2: { lx: 6, lz: 30, rx: -6, rz: 0, lift: 0 }, // instep at the big toe
    3: { lx: 0, lz: 62, rx: 0, rz: 0, lift: 0 }, // heel to toe
    4: { lx: 20, lz: 0, rx: -20, rz: 0, lift: 45 }, // on one foot
  };
  const c = Math.cos(Math.PI / 4), sn = Math.sin(Math.PI / 4);
  const proj = (x: number, z: number) => 500 + x * c + z * sn;
  const view45 = (p: Feet): Landmark[] => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, z: 0, visibility: 0.95 }));
    const set = (i: number, x: number, y: number) => (lm[i] = { x: x / 1000, y: y / 1000, z: 0, visibility: 0.95 });
    const hz = (p.lz + p.rz) / 2;
    set(23, proj(50, hz), 500);
    set(24, proj(-50, hz), 500);
    set(25, proj(p.lx, p.lz), 650);
    set(26, proj(p.rx, p.rz), 650 - p.lift);
    set(27, proj(p.lx, p.lz), 750);
    set(28, proj(p.rx, p.rz), 750 - p.lift);
    return lm;
  };

  it("recognizes every position, holds each for 10 s, and reports tandem held", () => {
    const fx = new FrontFeatures(1000, 1000);
    const det = new BalanceDetector();
    let t = 0;
    const tick = (pos: Feet) => {
      det.push(fx.push(t, view45(pos)), t);
      t += 1000 / 30;
    };
    for (const stage of [1, 2, 3, 4] as Stage[]) {
      det.startStage(stage, t);
      const prev = POS[(stage > 1 ? stage - 1 : 1) as Stage];
      // ~1.5 s still in the old position while the instruction is spoken, then the new one
      const startT = t;
      while (det.status === "waitStance" && t - startT < 20_000) tick(t - startT < 1500 ? prev : POS[stage]);
      while (det.status === "holding") tick(POS[stage]);
      expect(det.status).toBe("held");
    }
    expect(det.results.map((r) => r.stanceVerified)).toEqual([true, true, true, true]);
    expect(tandemHeld10(det.results)).toBe(true);
  });
});
