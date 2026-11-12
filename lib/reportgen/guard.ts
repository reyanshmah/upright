/**
 * Request guards for the report route (MASTER.md: "rate limit"). The route
 * calls a paid model, so it only takes small bodies, only from this site's own
 * pages, and only a few times a minute per address.
 */

/** Reads the body but stops as soon as it passes `max` bytes (null = too large). */
export async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Browsers send Origin on cross-site POSTs. If it is there, it must be this
 * host; requests without one (curl, server-to-server, tests) are allowed and
 * still rate limited.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Fixed-window limiter, per key, kept in memory (per server instance: a cost brake, not a wall). */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { start: number; n: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || now - h.start >= windowMs) {
      hits.set(key, { start: now, n: 1 });
      if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      return true;
    }
    h.n++;
    return h.n <= limit;
  };
}

/**
 * The caller's address as the hosting proxy reports it (Vercel always sets
 * x-forwarded-for itself). null = no proxy in front (local runs, tests,
 * server-to-server), which is not rate limited.
 */
export function clientKey(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
}
