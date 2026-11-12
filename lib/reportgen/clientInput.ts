/**
 * Builds the POST /api/report body from the session, on the phone. Only what
 * the schema allows leaves the device: the engine's typed results, the three
 * screening answers, an age band, sex and language. Never the name, exact
 * age, height, camera details or landmarks.
 */
import type { GateEvent } from "../contract";
import { isSkipped, type SessionState } from "../session";
import { ageBand } from "../sessionFile";
import type { ReportInput } from "./schema";

/** Keep the request under the server's 20 KB cap: the newest gate events are enough for the writer. */
const MAX_GATE_EVENTS = 60;

const gates = (log: GateEvent[]) => log.slice(-MAX_GATE_EVENTS).map(({ t, gate, ok }) => ({ t: Math.round(t), gate, ok }));
const clampErr = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 1);

export function buildReportInput(s: SessionState): ReportInput {
  const tug = s.tug;
  const chair = s.chair;
  return {
    schemaVersion: 1,
    lang: s.lang,
    ageBand: ageBand(s.profile.age) as ReportInput["ageBand"],
    sex: s.profile.sex,
    screening: {
      unsteady: s.screening.unsteady,
      worry: s.screening.worry,
      fallen: s.screening.fallen,
      fallCount: s.screening.fallen ? s.screening.fallCount : null,
      injured: s.screening.fallen ? s.screening.injured : null,
    },
    tug: !tug
      ? null
      : isSkipped(tug)
        ? { skipped: true }
        : {
            schemaVersion: 1,
            outcome: tug.outcome,
            ...(tug.refusalReason ? { refusalReason: tug.refusalReason } : {}),
            totalSec: tug.totalSec,
            riskFlag: tug.riskFlag,
            ...(tug.outcome === "full" && tug.phases ? { phases: tug.phases } : {}),
            timingErrorSec: clampErr(tug.timingErrorSec),
            medianFps: tug.medianFps,
            gateLog: gates(tug.gateLog),
          },
    chair: !chair
      ? null
      : isSkipped(chair)
        ? { skipped: true }
        : {
            schemaVersion: 1,
            outcome: chair.outcome,
            ...(chair.refusalReason ? { refusalReason: chair.refusalReason.slice(0, 60) } : {}),
            stands: chair.stands,
            armUse: chair.armUse,
            belowNorm: chair.belowNorm,
            medianFps: chair.medianFps,
            gateLog: gates(chair.gateLog),
          },
  };
}
