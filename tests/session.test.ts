import { describe, expect, it } from "vitest";
import { buildChairResult, buildTugResult } from "../lib/analysis";
import { ageBand, buildSessionFile, parseSessionFile, rescoreSessionFile } from "../lib/sessionFile";
import { FACE_LANDMARKS, faceRemoved, toRecorded } from "../lib/signal/privacy";
import { CONFIG_VERSION } from "../lib/signal/thresholds";
import { chairPath, stream, tugPath } from "./synth";

const gateLog = [
  { t: -3000, gate: "body" as const, ok: true },
  { t: -3000, gate: "one_person" as const, ok: true },
  { t: -3000, gate: "fps" as const, ok: true },
];
const ctx = { medianFps: 30, gateLog };

describe("face landmarks are never recorded", () => {
  it("blanks indices 0-10 and keeps the rest", () => {
    const lms = Array.from({ length: 33 }, (_, i) => ({ x: 0.1 * i, y: 0.2, z: 0.3, visibility: 0.9 }));
    const out = toRecorded(lms)!;
    expect(out).toHaveLength(33);
    for (let i = 0; i < FACE_LANDMARKS; i++) expect(out[i]).toEqual({ x: 0, y: 0, z: 0, visibility: 0 });
    expect(out[11]).toEqual(lms[11]);
    expect(out[28]).toEqual(lms[28]);
    expect(toRecorded(null)).toBeNull();
  });

  it("does not change the result: the detectors never read the face", () => {
    const raw = stream(tugPath, 12, 0.5);
    const stripped = { ...raw, frames: raw.frames.map((f) => ({ ...f, landmarks: toRecorded(f.landmarks) })) };
    expect(faceRemoved(raw.frames)).toBe(false);
    expect(faceRemoved(stripped.frames)).toBe(true);
    expect(buildTugResult(stripped, ctx).totalSec).toBe(buildTugResult(raw, ctx).totalSec);
    const cRaw = stream(chairPath(), 31, 0.5);
    const cStripped = { ...cRaw, frames: cRaw.frames.map((f) => ({ ...f, landmarks: toRecorded(f.landmarks) })) };
    expect(buildChairResult(cStripped, ctx, { age: 72, sex: "female" }).stands).toBe(12);
  });
});

describe("session file", () => {
  const tugFile = () => {
    const st = stream(tugPath, 12, 0.5);
    return buildSessionFile({ kind: "tug", stream: st, result: buildTugResult(st, ctx), age: 72, sex: "female", cueSource: "speech" });
  };

  it("replays to the same result that was on screen (TUG)", () => {
    const file = parseSessionFile(JSON.stringify(tugFile())); // as if downloaded and re-opened
    expect(rescoreSessionFile(file)).toEqual(file.result);
  });

  it("replays to the same result that was on screen (chair stand)", () => {
    const st = stream(chairPath(), 31, 0.5);
    const result = buildChairResult(st, ctx, { age: 72, sex: "female" });
    const file = parseSessionFile(
      JSON.stringify(buildSessionFile({ kind: "chair", stream: st, result, age: 72, sex: "female", cueSource: "mp3" })),
    );
    expect(file.result).toMatchObject({ stands: 12, outcome: "full" });
    expect(rescoreSessionFile(file)).toEqual(file.result);
  });

  it("stores no exact age, the config version, the cue source and a face-free stream", () => {
    const f = tugFile();
    expect(f.person).toEqual({ ageBand: "70-74", sex: "female" });
    expect(JSON.stringify(f)).not.toMatch(/"age"/);
    expect(f.configVersion).toBe(CONFIG_VERSION);
    expect(f.cue.source).toBe("speech");
    expect(faceRemoved(f.stream.frames)).toBe(true);
  });

  it("rejects files that are not session files", () => {
    expect(() => parseSessionFile("{}")).toThrow();
    expect(() => parseSessionFile({ schemaVersion: 1, kind: "tug" })).toThrow();
  });

  it("age bands follow the CDC table", () => {
    expect(ageBand(62)).toBe("60-64");
    expect(ageBand(94)).toBe("90-94");
    expect(ageBand(40)).toBe("<60");
    expect(ageBand(97)).toBe("95+");
  });
});
