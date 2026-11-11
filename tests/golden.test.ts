import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildChairResult, buildTugResult } from "../lib/analysis";
import { buildSessionFile } from "../lib/sessionFile";
import { toRecorded } from "../lib/signal/privacy";
import { checkGolden, type GoldenFile } from "./golden";
import { chairPath, stream, tugPath } from "./synth";

const DIR = join(__dirname, "golden");
const files = readdirSync(DIR).filter((f) => f.endsWith(".session.json"));

describe("golden streams (real recordings with annotated truth)", () => {
  if (files.length === 0) {
    // MASTER.md repo-review finding 3: commit 2-3 real streams. See tests/golden/README.md.
    it.todo("add 2-3 real golden streams from the Nov 8 runs (needs consent confirmed)");
  }
  for (const f of files) {
    it(`${f} still scores to its annotated truth`, () => {
      const g = JSON.parse(readFileSync(join(DIR, f), "utf8")) as GoldenFile;
      expect(checkGolden(g)).toEqual([]);
    });
  }
});

describe("golden checker (proves the harness can fail)", () => {
  const ctx = {
    medianFps: 30,
    gateLog: [
      { t: -3000, gate: "body" as const, ok: true },
      { t: -3000, gate: "one_person" as const, ok: true },
      { t: -3000, gate: "fps" as const, ok: true },
    ],
  };
  const person = { age: 72, sex: "female" as const };
  const chairGolden = (over: Partial<GoldenFile["golden"]> = {}): GoldenFile => {
    const raw = stream(chairPath(), 31, 0.5);
    const st = { ...raw, frames: raw.frames.map((fr) => ({ ...fr, landmarks: toRecorded(fr.landmarks) })) };
    const file = buildSessionFile({ kind: "chair", stream: st, result: buildChairResult(st, ctx, person), ...person, cueSource: "mp3" });
    return { ...file, golden: { consent: true, truth: { stands: 12, armUse: false }, ...over } };
  };

  it("passes a correct stream", () => {
    expect(checkGolden(chairGolden())).toEqual([]);
  });
  it("fails when the annotated count differs from what the code now counts", () => {
    expect(checkGolden(chairGolden({ truth: { stands: 11, armUse: false } })).join()).toMatch(/chair count 12 != annotated 11/);
  });
  it("fails when the stored result drifts from a fresh score", () => {
    const g = chairGolden();
    (g.result as { stands: number | null }).stands = 11;
    expect(checkGolden(g).join()).toMatch(/stands changed/);
  });
  it("fails without confirmed consent", () => {
    expect(checkGolden(chairGolden({ consent: false })).join()).toMatch(/consent/);
  });
  it("fails when face landmarks are present", () => {
    const g = chairGolden();
    g.stream.frames[3].landmarks![0] = { x: 0.5, y: 0.1, z: 0, visibility: 0.9 };
    expect(checkGolden(g).join()).toMatch(/face landmarks/);
  });
  it("fails a TUG outside the tolerance", () => {
    const raw = stream(tugPath, 12, 0.5);
    const st = { ...raw, frames: raw.frames.map((fr) => ({ ...fr, landmarks: toRecorded(fr.landmarks) })) };
    const file = buildSessionFile({ kind: "tug", stream: st, result: buildTugResult(st, ctx), ...person, cueSource: "mp3" });
    expect(checkGolden({ ...file, golden: { consent: true, truth: { totalSec: 9.7, tolSec: 0.5 } } })).toEqual([]);
    expect(checkGolden({ ...file, golden: { consent: true, truth: { totalSec: 11, tolSec: 0.5 } } }).join()).toMatch(/outside/);
  });
});
