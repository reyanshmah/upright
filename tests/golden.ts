import { rescoreSessionFile, type SessionFile } from "../lib/sessionFile";
import { faceRemoved } from "../lib/signal/privacy";

/** A session file plus the annotated truth and the consent confirmation. */
export type GoldenFile = SessionFile & {
  golden: {
    /** Written consent confirmed for this recording to be committed. Must be true. */
    consent: boolean;
    truth: { totalSec: number; tolSec: number } | { stands: number; armUse: boolean };
    note?: string;
  };
};

/** Returns a list of problems; empty = the golden stream passes. */
export function checkGolden(file: GoldenFile): string[] {
  const problems: string[] = [];
  if (file.golden?.consent !== true) problems.push("consent is not confirmed (golden.consent must be true)");
  if (!faceRemoved(file.stream.frames)) problems.push("face landmarks 0-10 are not removed (run scripts/strip-face.mjs)");

  const now = rescoreSessionFile(file);
  const truth = file.golden.truth;
  if (file.kind === "tug" && "totalSec" in truth) {
    const got = (now as { totalSec: number | null }).totalSec;
    if (got === null || Math.abs(got - truth.totalSec) > truth.tolSec) {
      problems.push(`TUG total ${got} s is outside ${truth.totalSec} +/- ${truth.tolSec} s`);
    }
  } else if (file.kind === "chair" && "stands" in truth) {
    const r = now as { stands: number | null; armUse: boolean };
    if (r.stands !== truth.stands) problems.push(`chair count ${r.stands} != annotated ${truth.stands}`);
    if (r.armUse !== truth.armUse) problems.push(`arm use ${r.armUse} != annotated ${truth.armUse}`);
  } else {
    problems.push("truth does not match the test kind");
  }

  // The stored result is the frozen reference: any change must be justified in the commit.
  const stored = file.result as unknown as Record<string, unknown>;
  const fresh = now as unknown as Record<string, unknown>;
  for (const k of ["outcome", "totalSec", "stands", "armUse"]) {
    if (k in stored && JSON.stringify(stored[k]) !== JSON.stringify(fresh[k])) {
      problems.push(`${k} changed: stored ${JSON.stringify(stored[k])} -> now ${JSON.stringify(fresh[k])}`);
    }
  }
  return problems;
}
