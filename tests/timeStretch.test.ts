import { describe, expect, it } from "vitest";
import { timeStretch } from "../lib/timeStretch";

const SR = 16000;
function tone(hz: number, seconds: number): Float32Array {
  const x = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
}
/** Frequency from upward zero crossings over the middle of the signal. */
function freq(x: Float32Array): number {
  const a = Math.floor(x.length * 0.2), b = Math.floor(x.length * 0.8);
  let n = 0;
  for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) n++;
  return n / ((b - a) / SR);
}

describe("timeStretch (voice speed)", () => {
  it("returns the input unchanged at normal speed", () => {
    const x = [tone(220, 1)];
    expect(timeStretch(x, SR, 1)).toBe(x);
  });

  for (const rate of [0.75, 0.5]) {
    it(`at ${rate}x it lasts 1/${rate} as long and keeps the pitch`, () => {
      const [y] = timeStretch([tone(220, 1)], SR, rate);
      expect(y.length).toBe(Math.ceil(SR / rate));
      expect(freq(y)).toBeGreaterThan(210);
      expect(freq(y)).toBeLessThan(230);
    });
  }
});
