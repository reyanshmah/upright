/**
 * The report pipeline (MASTER.md "Report pipeline"): write with the model,
 * check, regenerate once with the checker's reasons, then fall back to the
 * template. Pure apart from the injected model call, so tests run offline.
 */
import { checkReport } from "./check";
import { writerFacts } from "./facts";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import type { ReportInput, ReportOutput } from "./schema";
import { templateReport } from "./template";

/** Calls the model; returns null for a refusal or unparseable output. May throw (network, timeout). */
export type CallModel = (req: { system: string; user: string; timeoutMs: number }) => Promise<ReportOutput | null>;

export type ReportSource = "model" | "regenerated" | "template";

export interface ReportResult {
  report: ReportOutput;
  /** Which path wrote the text (recorded by the study). */
  source: ReportSource;
  /** Why the model's attempts were rejected (empty when the first attempt passed). */
  rejected: string[][];
  lang: "en" | "es";
}

/** Total time budget for the model path (MASTER.md: 15 s). */
export const REPORT_TIMEOUT_MS = 15_000;
/** Don't start a second attempt with less time than this left. */
const MIN_ATTEMPT_MS = 3_000;

export async function generateReport(
  input: ReportInput,
  callModel: CallModel | null,
  now: () => number = () => Date.now(),
): Promise<ReportResult> {
  const { facts, allowed } = writerFacts(input);
  const rejected: string[][] = [];
  const template = (): ReportResult => ({ report: templateReport(facts), source: "template", rejected, lang: facts.lang });
  if (!callModel) return template();

  const deadline = now() + REPORT_TIMEOUT_MS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - now();
    if (left < MIN_ATTEMPT_MS) break;
    let problems: string[];
    try {
      const out = await callModel({ system: SYSTEM_PROMPT, user: userMessage(facts, rejected[attempt - 1]), timeoutMs: left });
      problems = out ? checkReport(out, facts, allowed) : ["no usable output (refusal or unparseable)"];
      if (out && !problems.length) {
        return { report: out, source: attempt === 0 ? "model" : "regenerated", rejected, lang: facts.lang };
      }
    } catch (e) {
      problems = [`model call failed: ${e instanceof Error ? e.name : "error"}`];
    }
    rejected.push(problems);
  }
  return template();
}
