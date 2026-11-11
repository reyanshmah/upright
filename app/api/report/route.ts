/**
 * POST /api/report: results JSON in, family plan + clinician summary out.
 * The server only ever sees numbers: no name, exact age, video or landmarks
 * (the schema rejects them). Without ANTHROPIC_API_KEY it returns the template.
 */
import { anthropicCaller } from "../../../lib/reportgen/anthropic";
import { generateReport } from "../../../lib/reportgen/generate";
import { MAX_BODY_BYTES, validateReportInput } from "../../../lib/reportgen/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return Response.json({ error: "body too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }
  const v = validateReportInput(raw);
  if (!v.ok) return Response.json({ error: "invalid results JSON", details: v.errors }, { status: 400 });

  const result = await generateReport(v.input, anthropicCaller());
  return Response.json({
    report: result.report,
    source: result.source,
    lang: result.lang,
    rejectedAttempts: result.rejected.length,
  });
}
