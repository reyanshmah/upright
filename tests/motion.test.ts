import { describe, expect, it } from "vitest";
import { integrateTurn, turnDeg, type Turn3 } from "../lib/motion";
import { MOTION } from "../lib/signal/thresholds";

/** Run a gyroscope signal (deg/s per axis, as a function of time) at 60 Hz. */
function run(seconds: number, rate: (t: number) => { alpha: number; beta: number; gamma: number }) {
  let turn: Turn3 = { a: 0, b: 0, g: 0 };
  let peak = 0;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    turn = integrateTurn(turn, rate(t), dt);
    peak = Math.max(peak, turnDeg(turn));
  }
  return { peak, end: turnDeg(turn) };
}

describe("phone movement (gyroscope)", () => {
  it("ignores hand tremor and wobble while the tester holds the phone", () => {
    // ±40 deg/s wobble at 3 Hz on two axes: the phone shakes but keeps pointing the same way.
    const r = run(60, (t) => ({ alpha: 40 * Math.sin(2 * Math.PI * 3 * t), beta: 25 * Math.cos(2 * Math.PI * 2 * t), gamma: 0 }));
    expect(r.peak).toBeLessThan(MOTION.phoneMovedDeg);
  });

  it("ignores slow sensor drift over a whole test", () => {
    // 0.5 deg/s uncorrected gyro bias for 60 s would add up to 30 deg without the leak.
    const r = run(60, () => ({ alpha: 0.5, beta: 0, gamma: 0 }));
    expect(r.peak).toBeLessThan(MOTION.phoneMovedDeg);
  });

  it("catches a real re-aim of the phone (20 deg in half a second)", () => {
    const r = run(2, (t) => ({ alpha: t < 0.5 ? 40 : 0, beta: 0, gamma: 0 }));
    expect(r.peak).toBeGreaterThan(MOTION.phoneMovedDeg);
  });

  it("catches the phone being picked up and tilted on two axes", () => {
    const r = run(2, (t) => ({ alpha: 0, beta: t < 1 ? 15 : 0, gamma: t < 1 ? 15 : 0 }));
    expect(r.peak).toBeGreaterThan(MOTION.phoneMovedDeg);
  });
});
