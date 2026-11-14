/**
 * GET /api/health: confirms a deployment is up and which build it runs (MASTER.md "Routes").
 * GET /api/health?check=1 also makes one tiny call to the report model, so a deploy's
 * API key can be checked from a browser. Rate limited; never returns the key.
 */
import Anthropic from "@anthropic-ai/sdk";
import { REPORT_MODEL } from "../../../lib/reportgen/anthropic";
import { describeModelError } from "../../../lib/reportgen/generate";
import { clientKey, makeRateLimiter } from "../../../lib/reportgen/guard";
import { APP_VERSION, BUILD_ID } from "../../../lib/version";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const checkLimited = makeRateLimiter(5, 60_000);

async function modelCheck(req: Request): Promise<string> {
  const key = clientKey(req);
  if (key !== null && !checkLimited(key)) return "rate_limited (try again in a minute)";
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
    // Same model, beta and fallback options as the report call (lib/reportgen/anthropic.ts).
    await client.beta.messages.create(
      {
        model: REPORT_MODEL,
        max_tokens: 16,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        messages: [{ role: "user", content: "Reply with OK." }],
      },
      { timeout: 20_000 },
    );
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "";
    return `failed: ${describeModelError(e)}${msg ? ` - ${msg}` : ""}`;
  }
}

export async function GET(req: Request): Promise<Response> {
  // Whether the AI plan writer has a key (never the key itself).
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const reportWriter = hasKey ? "configured" : "missing_api_key";
  const check = new URL(req.url).searchParams.get("check") === "1";
  const extra = check && hasKey ? { model: REPORT_MODEL, modelCheck: await modelCheck(req) } : {};
  return Response.json(
    { ok: true, version: APP_VERSION, build: BUILD_ID, reportWriter, ...extra },
    { headers: { "cache-control": "no-store" } },
  );
}
