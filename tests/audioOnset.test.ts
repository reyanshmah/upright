import { describe, expect, it } from "vitest";
import { audibleOnsetMs } from "../lib/audioOnset";

const SR = 44100;
/** Silence, then a faint lead-in (MP3 pre-echo), then a loud tone. */
function cue(silenceMs: number, leadMs: number) {
  const n = Math.round(((silenceMs + leadMs + 300) / 1000) * SR);
  const x = new Float32Array(n);
  const s0 = Math.round((silenceMs / 1000) * SR), s1 = Math.round(((silenceMs + leadMs) / 1000) * SR);
  for (let i = s0; i < n; i++) x[i] = (i < s1 ? 0.005 : 0.5) * Math.sin((2 * Math.PI * 220 * i) / SR);
  return x;
}

describe("cue audible onset", () => {
  it("finds the loud part, not the faint lead-in", () => {
    expect(audibleOnsetMs(cue(15, 10), SR)).toBeGreaterThan(20);
    expect(audibleOnsetMs(cue(15, 10), SR)).toBeLessThan(27);
  });
  it("is ~0 when the cue starts immediately", () => {
    expect(audibleOnsetMs(cue(0, 0), SR)).toBeLessThan(2);
  });
  it("handles silence and empty buffers", () => {
    expect(audibleOnsetMs(new Float32Array(1000), SR)).toBe(0);
    expect(audibleOnsetMs(new Float32Array(0), SR)).toBe(0);
  });
});
