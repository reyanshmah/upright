import { describe, expect, it } from "vitest";
import { reportFacts, stepOrder } from "../lib/report";
import type { SessionState } from "../lib/session";
import { pixelsPerMeter, distanceM, EYE_HEIGHT_RATIO } from "../lib/measure";

const base: SessionState = {
  lang: "en",
  runner: "helper",
  profile: { firstName: "", age: 72, sex: "female", walkingAid: "none", heightCm: 160 },
  screening: { unsteady: false, worry: false, fallen: false, fallCount: null, injured: null },
  createdAt: "2026-11-08T00:00:00Z",
};
const tug = (s: number) => ({ totalS: s, source: "manual" as const, manualS: s, observations: [], lookedUnsteady: false, fpsMedian: 30, gatesPassed: true });
const chair = (n: number, arms = false) => ({ count: n, armsUsed: arms, source: "manual" as const, manualCount: n, fpsMedian: 30, gatesPassed: true });

describe("report", () => {
  it("no risk -> exercise, home, repeat (no doctor-first)", () => {
    const f = reportFacts({ ...base, tug: tug(9), chair: chair(14) });
    expect(f.higherRisk).toBe(false);
    expect(stepOrder(f)).toEqual(["exercise", "home", "repeat"]);
  });
  it("TUG >= 12 s -> doctor first, then exercise", () => {
    const f = reportFacts({ ...base, tug: tug(12), chair: chair(14) });
    expect(f.tugAtRisk).toBe(true);
    expect(stepOrder(f).slice(0, 2)).toEqual(["doctor", "exercise"]);
  });
  it("screen-only risk -> doctor first, meds before exercise", () => {
    const f = reportFacts({ ...base, screening: { ...base.screening, worry: true }, tug: tug(9), chair: chair(14) });
    expect(stepOrder(f)).toEqual(["doctor", "meds", "exercise", "home"]);
  });
  it("arms used -> chair score 0 and below average", () => {
    const f = reportFacts({ ...base, tug: tug(9), chair: chair(15, true) });
    expect(f.chairScore).toBe(0);
    expect(f.chairBelow).toBe(true);
  });
  it("every higher-risk plan recommends the doctor", () => {
    for (const s of [tug(13), tug(20)]) {
      expect(stepOrder(reportFacts({ ...base, tug: s }))[0]).toBe("doctor");
    }
  });
});

describe("3 m measurement math", () => {
  it("recovers distance from height scale", () => {
    // 160 cm person, eye-to-heel spans 300 px in a 1000x1000 frame
    const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    lms[2].y = lms[5].y = 0.3; // eyes
    lms[29].y = lms[30].y = 0.6; // heels
    const ppm = pixelsPerMeter(lms, 1000, 1000, 160);
    expect(ppm).toBeCloseTo(300 / (1.6 * EYE_HEIGHT_RATIO), 5);
    expect(distanceM(100, 100 + 3 * ppm, ppm)).toBeCloseTo(3, 5);
  });
});
