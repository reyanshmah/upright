/**
 * The ONLY input POST /api/report accepts: the engine's typed results plus the
 * screening answers, an age band and the language. Objects are strict, so a
 * name, exact age, height, video or landmark stream is rejected, not ignored.
 * Ranges follow MASTER.md ("a TUG under 2 s or over 60 s, more than 40 stands").
 */
import { z } from "zod";
import { CHAIR_STAND_NORMS, scoreChairStand, tugAtRisk } from "../signal/thresholds";
import { bandAge } from "../sessionFile";

export const AGE_BANDS = [
  `<${CHAIR_STAND_NORMS[0].ageMin}`,
  ...CHAIR_STAND_NORMS.map((r) => `${r.ageMin}-${r.ageMax}`),
  "95+",
] as const;

const Gate = z.enum(["body", "one_person", "fps", "light", "seated", "arms"]);
const GateLog = z.array(z.strictObject({ t: z.number().finite(), gate: Gate, ok: z.boolean() })).max(500);
const Sec = z.number().finite().min(0).max(60);

const Phases = z.strictObject({ standUp: Sec, walkOut: Sec, turn: Sec, walkBack: Sec, sitDown: Sec });

const Tug = z
  .strictObject({
    schemaVersion: z.literal(1),
    outcome: z.enum(["full", "total_only", "refused"]),
    refusalReason: z.enum(["fps_low", "second_person", "not_visible_at_start_or_end", "aborted", "tab_hidden"]).optional(),
    totalSec: z.number().finite().min(2).max(60).nullable(),
    riskFlag: z.boolean().nullable(),
    phases: Phases.optional(),
    timingErrorSec: z.number().finite().min(0).max(1),
    medianFps: z.number().finite().min(0).max(240),
    gateLog: GateLog,
  })
  .superRefine((r, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: "custom", message });
    if (r.outcome === "refused") {
      if (r.totalSec !== null || r.riskFlag !== null || r.phases) bad("a refused TUG carries no time, risk flag or phases");
    } else {
      if (r.totalSec === null) bad("a measured TUG needs totalSec");
      else if (r.riskFlag !== tugAtRisk(r.totalSec)) bad("riskFlag does not match totalSec >= 12");
      if (r.phases && r.outcome !== "full") bad("phases are only sent with outcome full");
    }
  });

const Chair = z
  .strictObject({
    schemaVersion: z.literal(1),
    outcome: z.enum(["full", "refused"]),
    refusalReason: z.string().max(60).optional(),
    stands: z.number().int().min(0).max(40).nullable(),
    armUse: z.boolean(),
    belowNorm: z.boolean().nullable(),
    medianFps: z.number().finite().min(0).max(240),
    gateLog: GateLog,
  })
  .superRefine((r, ctx) => {
    if (r.outcome === "refused" && (r.stands !== null || r.belowNorm !== null)) {
      ctx.addIssue({ code: "custom", message: "a refused chair stand carries no count or norm flag" });
    }
    if (r.outcome === "full" && r.stands === null) ctx.addIssue({ code: "custom", message: "a full chair stand needs stands" });
  });

const Skipped = z.strictObject({ skipped: z.literal(true) });

/** NEW Nov 14: the balance test, so a balance risk no longer forces the standard plan. */
const Balance = z
  .strictObject({
    stages: z
      .array(z.strictObject({ stage: z.number().int().min(1).max(4), heldSec: z.number().finite().min(0).max(10), completed: z.boolean() }))
      .max(4),
    tandemHeld10: z.boolean(),
  })
  .superRefine((r, ctx) => {
    if (r.tandemHeld10 !== r.stages.some((x) => x.stage === 3 && x.completed)) {
      ctx.addIssue({ code: "custom", message: "tandemHeld10 does not match the stages" });
    }
  });

export const ReportInputSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    lang: z.enum(["en", "es"]),
    ageBand: z.enum(AGE_BANDS),
    sex: z.enum(["female", "male"]),
    screening: z.strictObject({
      unsteady: z.boolean(),
      worry: z.boolean(),
      fallen: z.boolean(),
      fallCount: z.enum(["1", "2", "3+"]).nullable(),
      injured: z.boolean().nullable(),
    }),
    tug: z.union([Tug, Skipped]).nullable(),
    chair: z.union([Chair, Skipped]).nullable(),
    balance: z.union([Balance, Skipped]).nullable().optional(),
    /** Not identifying; lets the plan fit a cane or walker. */
    walkingAid: z.enum(["none", "cane", "walker", "other"]).nullable().optional(),
  })
  .superRefine((r, ctx) => {
    // The norm flag must match the CDC table for this age band and sex.
    const c = r.chair;
    if (c && !("skipped" in c) && c.outcome === "full" && c.stands !== null) {
      const want = scoreChairStand(c.stands, c.armUse, bandAge(r.ageBand), r.sex).belowAverage;
      if (c.belowNorm !== want) ctx.addIssue({ code: "custom", message: "belowNorm does not match the CDC table" });
    }
    if (!r.screening.fallen && (r.screening.fallCount !== null || r.screening.injured !== null)) {
      ctx.addIssue({ code: "custom", message: "fall follow-ups are only sent when fallen = true" });
    }
  });

export type ReportInput = z.infer<typeof ReportInputSchema>;

/** Max request body (bytes). */
export const MAX_BODY_BYTES = 20_000;

export function validateReportInput(raw: unknown): { ok: true; input: ReportInput } | { ok: false; errors: string[] } {
  const r = ReportInputSchema.safeParse(raw);
  if (r.success) return { ok: true, input: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
}

/** What the model must return (structured output). */
export const ReportOutputSchema = z.object({
  /** One or two sentences for the family, in the session language. */
  familySummary: z.string(),
  /** The family action plan, in the given order. */
  familySteps: z.array(z.object({ title: z.string(), body: z.string() })),
  /** A short factual summary for the doctor, always in English. */
  clinicianSummary: z.string(),
});

export type ReportOutput = z.infer<typeof ReportOutputSchema>;
