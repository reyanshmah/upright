/** GET /api/health: confirms a deployment is up and which build it runs (MASTER.md "Routes"). */
import { APP_VERSION, BUILD_ID } from "../../../lib/version";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true, version: APP_VERSION, build: BUILD_ID }, { headers: { "cache-control": "no-store" } });
}
