import { describe, expect, it } from "vitest";
import { countChairStands, StandStateMachine } from "../lib/signal/chairStand";
import { OneEuroFilter } from "../lib/signal/oneEuro";
import { tugAtRisk } from "../lib/signal/thresholds";

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
