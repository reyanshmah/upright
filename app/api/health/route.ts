/** GET /api/health: confirms a deployment is up and which build it runs (MASTER.md "Routes"). */
import { APP_VERSION, BUILD_ID } from "../../../lib/version";

export const dynamic = "force-dynamic";

export function GET(): Response {
  // Whether the AI plan writer has a key (never the key itself), so a deploy can be checked from a browser.
  const reportWriter = process.env.ANTHROPIC_API_KEY ? "configured" : "missing_api_key";
  return Response.json({ ok: true, version: APP_VERSION, build: BUILD_ID, reportWriter }, { headers: { "cache-control": "no-store" } });
}
