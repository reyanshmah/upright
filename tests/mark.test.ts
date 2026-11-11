import { describe, expect, it } from "vitest";
import { analyzeTug, buildTugResult, checkMark, tugMarkVisible, type RunContext } from "../lib/analysis";
import type { GateEvent } from "../lib/contract";
import type { LandmarkStream } from "../lib/signal/types";
import { body, lerp, stream, tugPath } from "./synth";

/** Clean gate log: every live gate held, so only the 3 m check can change the outcome. */
const gateLog: GateEvent[] = [
  { t: -3000, gate: "body", ok: true },
  { t: -3000, gate: "one_person", ok: true },
  { t: -3000, gate: "fps", ok: true },
];
const ctx = (): RunContext => ({ medianFps: 30, gateLog });

/** TUG walking out to `farX` px (image is 1000 px wide), same timing as tugPath. */
const walkTo = (farX: number) => (t: number) => {
  const A = 200;
  let x = A, phi = 90;
  if (t < 0.6) phi = 90;
  else if (t < 1.6) phi = lerp(90, 0, (t - 0.6) / 1.0);
  else if (t < 5.0) { phi = 0; x = lerp(A, farX, (t - 1.6) / 3.4); }
  else if (t < 6.0) { phi = 0; x = farX; }
  else if (t < 9.4) { phi = 0; x = lerp(farX, A, (t - 6.0) / 3.4); }
  else phi = lerp(0, 90, (t - 9.4) / 1.0);
  return body(x, phi);
};

/** Lower the ankle visibility (feet hard to see) inside [fromS, toS] of stream time. */
function dimFeet(s: LandmarkStream, fromS: number, toS: number): LandmarkStream {
  return {
    ...s,
    frames: s.frames.map((f) =>
      f.t < fromS * 1000 || f.t > toS * 1000 || !f.landmarks
        ? f
        : { ...f, landmarks: f.landmarks.map((p, i) => (i >= 27 ? { ...p, visibility: 0.35 } : p)) },
    ),
  };
}

describe("3 m visibility check (TUG)", () => {
  it("normal walk: the whole path is visible -> Full", () => {
    const s = stream(tugPath, 12, 0.5); // turns at hip x = 0.85
    expect(tugMarkVisible(s)).toBe(true);
    const r = buildTugResult(s, ctx());
    expect(r.outcome).toBe("full");
    expect(r.phases).toBeDefined();
  });

  it("person walks out of the frame at the far end -> Total only", () => {
    const s = stream(walkTo(1150), 12, 0.5); // ankle reaches x = 1.15, outside the image
    const a = analyzeTug(s)!;
    expect(a).not.toBeNull(); // the time is still found...
    const m = checkMark(s, { goT: a.goT, turnT: a.turnT, endT: a.endT });
    expect(m.turnOk).toBe(false); // ...but the turn point was not seen
    expect(tugMarkVisible(s)).toBe(false);
    const r = buildTugResult(s, ctx());
    expect(r.outcome).toBe("total_only");
    expect(r.totalSec).not.toBeNull();
    expect(r.phases).toBeUndefined();
  });

  it("hip inside the image but within the 5% edge margin at the turn -> Total only", () => {
    const s = stream(walkTo(970), 12, 0.5); // joints visible, hip x = 0.97 > 0.95
    const a = analyzeTug(s)!;
    const m = checkMark(s, { goT: a.goT, turnT: a.turnT, endT: a.endT });
    expect(m).toMatchObject({ turnOk: false, startFeetOk: true, endFeetOk: true });
    expect(buildTugResult(s, ctx()).outcome).toBe("total_only");
  });

  it("hip just inside the margin passes", () => {
    const s = stream(walkTo(930), 12, 0.5); // hip x = 0.93
    expect(tugMarkVisible(s)).toBe(true);
  });

  it("feet not visible at the start -> Total only", () => {
    const s = dimFeet(stream(tugPath, 12, 0.5), 0, 0.9);
    const a = analyzeTug(s)!;
    expect(checkMark(s, { goT: a.goT, turnT: a.turnT, endT: a.endT })).toMatchObject({ startFeetOk: false, endFeetOk: true });
    expect(buildTugResult(s, ctx()).outcome).toBe("total_only");
  });

  it("feet not visible at the final sit -> Total only", () => {
    const s0 = stream(tugPath, 12, 0.5);
    const endS = analyzeTug(s0)!.endT / 1000;
    const s = dimFeet(s0, endS - 0.4, endS + 0.4);
    const a = analyzeTug(s)!;
    expect(checkMark(s, { goT: a.goT, turnT: a.turnT, endT: a.endT })).toMatchObject({ startFeetOk: true, endFeetOk: false });
    expect(buildTugResult(s, ctx()).outcome).toBe("total_only");
  });

  it("one bad frame at the turn does not fail the check", () => {
    const s0 = stream(tugPath, 12, 0.5);
    const turnT = analyzeTug(s0)!.turnT!;
    const i = s0.frames.findIndex((f) => f.t >= turnT);
    const frames = s0.frames.slice();
    frames[i] = { ...frames[i], landmarks: null };
    expect(tugMarkVisible({ ...s0, frames })).toBe(true);
  });

  it("no turn point found -> the check fails", () => {
    const s = stream(tugPath, 12, 0.5);
    expect(checkMark(s, { goT: 500, turnT: null, endT: 10_000 }).ok).toBe(false);
  });

  it("an explicit markVisible=false still wins over a passing stream", () => {
    expect(buildTugResult(stream(tugPath, 12, 0.5), { ...ctx(), markVisible: false }).outcome).toBe("total_only");
  });
});
