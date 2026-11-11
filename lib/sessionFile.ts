/**
 * The session file: one JSON per finished test holding the typed result AND the
 * landmark stream it was computed from, so the download reproduces the number
 * on screen (replayed through the same detectors). Face landmarks are always
 * blank. Kept on the study laptop; never sent to a server.
 */
import type { ChairStandResult, TugResult } from "./contract";
import { buildChairResult, buildTugResult, type ChairBuild } from "./analysis/results";
import { toRecorded } from "./signal/privacy";
import { CHAIR_STAND_NORMS, CONFIG_VERSION, type Sex } from "./signal/thresholds";
import type { LandmarkStream } from "./signal/types";
import { APP_VERSION } from "./version";

export type CueSource = "mp3" | "speech" | "unknown";

export interface SessionFile {
  schemaVersion: 1;
  appVersion: string;
  /** lib/signal/thresholds.ts CONFIG_VERSION in force when the test ran. */
  configVersion: string;
  createdAt: string;
  kind: "tug" | "chair";
  /** How the Go cue was produced: speech starts after a variable, unmeasured delay. */
  cue: { source: CueSource };
  /** Age band, not exact age; enough to look up the CDC chair-stand norm. */
  person: { ageBand: string; sex: Sex };
  context: { markVisible: boolean | null; aborted: boolean; tabHidden: boolean };
  result: TugResult | ChairBuild;
  stream: LandmarkStream;
}

export function ageBand(age: number): string {
  const row = CHAIR_STAND_NORMS.find((r) => age >= r.ageMin && age <= r.ageMax);
  if (row) return `${row.ageMin}-${row.ageMax}`;
  return age < CHAIR_STAND_NORMS[0].ageMin ? `<${CHAIR_STAND_NORMS[0].ageMin}` : "95+";
}

/** Lowest age in a band, used only to look up the norm (re-scoring, reports). */
export function bandAge(band: string): number {
  const m = /^(\d+)-/.exec(band);
  if (m) return Number(m[1]);
  return band.startsWith("<") ? 0 : 95;
}

export function buildSessionFile(args: {
  kind: "tug" | "chair";
  stream: LandmarkStream;
  result: TugResult | ChairBuild;
  age: number;
  sex: Sex;
  cueSource: CueSource;
  markVisible?: boolean | null;
  aborted?: boolean;
  tabHidden?: boolean;
  now?: Date;
}): SessionFile {
  return {
    schemaVersion: 1,
    appVersion: APP_VERSION,
    configVersion: CONFIG_VERSION,
    createdAt: (args.now ?? new Date()).toISOString(),
    kind: args.kind,
    cue: { source: args.cueSource },
    person: { ageBand: ageBand(args.age), sex: args.sex },
    context: { markVisible: args.markVisible ?? null, aborted: !!args.aborted, tabHidden: !!args.tabHidden },
    result: args.result,
    // Defensive: blank the face even if a caller passed an unsanitized stream.
    stream: { ...args.stream, frames: args.stream.frames.map((f) => ({ ...f, landmarks: toRecorded(f.landmarks) })) },
  };
}

export function parseSessionFile(raw: string | unknown): SessionFile {
  const f = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<SessionFile> | null;
  if (!f || f.schemaVersion !== 1) throw new Error("Not an Upright session file (schemaVersion 1).");
  if (f.kind !== "tug" && f.kind !== "chair") throw new Error("Session file has no test kind.");
  if (!f.stream || !Array.isArray(f.stream.frames)) throw new Error("Session file has no landmark stream.");
  if (!f.result || !f.person) throw new Error("Session file is missing its result or person.");
  return f as SessionFile;
}

/**
 * Recompute the result from the stream with the CURRENT detectors and
 * thresholds. With unchanged code it equals file.result (minus live-only
 * fallbacks); after a threshold change it shows what the new numbers would be.
 */
export function rescoreSessionFile(file: SessionFile): TugResult | ChairBuild {
  const ctx = {
    medianFps: file.result.medianFps,
    gateLog: file.result.gateLog,
    markVisible: file.context.markVisible,
    aborted: file.context.aborted,
    tabHidden: file.context.tabHidden,
  };
  return file.kind === "tug"
    ? buildTugResult(file.stream, ctx)
    : buildChairResult(file.stream, ctx, { age: bandAge(file.person.ageBand), sex: file.person.sex });
}

export function sessionFileName(f: SessionFile): string {
  return `${f.stream.sessionId}.session.json`;
}

export type { ChairStandResult };
