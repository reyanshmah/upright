import { describe, expect, it } from "vitest";
import { accumulateUp, turnOf, uprightLandmarks, uprightSize, type Turn } from "../lib/pose/orientation";
import type { Landmark } from "../lib/signal/types";

/** Upright body: shoulders at y=0.3, hips at y=0.6, off-center so rotations are distinguishable. */
function body(): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.4, y: 0.5, z: 0, visibility: 1 }));
  lms[11] = { x: 0.35, y: 0.3, z: 0, visibility: 1 };
  lms[12] = { x: 0.45, y: 0.3, z: 0, visibility: 1 };
  lms[23] = { x: 0.36, y: 0.6, z: 0, visibility: 1 };
  lms[24] = { x: 0.44, y: 0.6, z: 0, visibility: 1 };
  return lms;
}

/** What the camera would deliver if the picture were turned (inverse of uprightLandmarks). */
function rotateRaw(lms: Landmark[], turn: Turn): Landmark[] {
  return lms.map((p) => {
    const { x, y } = p;
    const [nx, ny] = turn === 0 ? [x, y] : turn === 180 ? [1 - x, 1 - y] : turn === 90 ? [1 - y, x] : [y, 1 - x];
    return { ...p, x: nx, y: ny };
  });
}

describe("upright correction", () => {
  for (const turn of [0, 90, 180, 270] as Turn[]) {
    it(`detects and undoes a ${turn}° picture`, () => {
      const up = body();
      const raw = rotateRaw(up, turn);
      const size = uprightSize(1280, 720, turn); // raw frame dims for this case
      const acc = { x: 0, y: 0 };
      accumulateUp(acc, raw, size.w, size.h, 0.5);
      expect(turnOf(acc)).toBe(turn);
      const back = uprightLandmarks(raw, turn);
      back.forEach((p, i) => {
        expect(p.x).toBeCloseTo(up[i].x, 6);
        expect(p.y).toBeCloseTo(up[i].y, 6);
      });
    });
  }

  it("leaves an upright picture untouched", () => {
    const acc = { x: 0, y: 0 };
    accumulateUp(acc, body(), 720, 1280, 0.5);
    expect(turnOf(acc)).toBe(0);
  });
});
