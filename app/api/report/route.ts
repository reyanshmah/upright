/**
 * POST /api/report: results JSON in, family plan + clinician summary out.
 * The server only ever sees numbers: no name, exact age, video or landmarks
 * (the schema rejects them). Without ANTHROPIC_API_KEY it returns the template.
 */
import { anthropicCaller } from "../../../lib/reportgen/anthropic";
import { generateReport } from "../../../lib/reportgen/generate";
import { clientKey, makeRateLimiter, readCapped, sameOrigin } from "../../../lib/reportgen/guard";
import { MAX_BODY_BYTES, validateReportInput } from "../../../lib/reportgen/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A family opens results once or twice (and maybe switches language): 20 a minute is plenty. */
const limited = makeRateLimiter(20, 60_000);

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "cross-site request" }, { status: 403 });
  const key = clientKey(req);
  if (key !== null && !limited(key)) {
    return Response.json({ error: "too many requests" }, { status: 429, headers: { "retry-after": "60" } });
  }
  const text = await readCapped(req, MAX_BODY_BYTES);
  if (text === null) return Response.json({ error: "body too large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400 });
  }
  const v = validateReportInput(raw);
  if (!v.ok) return Response.json({ error: "invalid results JSON", details: v.errors }, { status: 400 });

  const result = await generateReport(v.input, anthropicCaller());
  return Response.json(
    {
      report: result.report,
      source: result.source,
      lang: result.lang,
      rejectedAttempts: result.rejected.length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
