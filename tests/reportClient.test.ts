import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/report/route";
import { buildReportInput } from "../lib/reportgen/clientInput";
import { clientKey, makeRateLimiter, readCapped, sameOrigin } from "../lib/reportgen/guard";
import { MAX_BODY_BYTES, validateReportInput } from "../lib/reportgen/schema";
import type { ChairEntry, SessionState, TugEntry } from "../lib/session";
import { scoreChairStand } from "../lib/signal/thresholds";

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "")); // never call the real API
afterEach(() => vi.unstubAllEnvs());

const gateLog = (n: number) => Array.from({ length: n }, (_, i) => ({ t: i * 33.3333, gate: "body" as const, ok: i % 2 === 0 }));

const tugFull: TugEntry = {
  schemaVersion: 1, outcome: "full", totalSec: 13.4, riskFlag: true,
  phases: { standUp: 1.5, walkOut: 3.9, turn: 1.6, walkBack: 3.8, sitDown: 2.6 },
  timingErrorSec: 0.036, medianFps: 28, gateLog: gateLog(500), camera: { label: "Back Camera", zoom: 0.5, wide: true },
};
const chairFor = (age: number, stands: number): ChairEntry => ({
  schemaVersion: 1, outcome: "full", stands, armUse: false,
  belowNorm: scoreChairStand(stands, false, age, "female").belowAverage,
  medianFps: 27, gateLog: gateLog(500), halfwayCounted: true,
});

function session(over: Partial<SessionState> = {}): SessionState {
  return {
    lang: "es", runner: "helper",
    profile: { firstName: "Maria", age: 78, sex: "female", walkingAid: "cane", heightCm: 160 },
    screening: { unsteady: true, worry: false, fallen: true, fallCount: "2", injured: false },
    tug: tugFull, chair: chairFor(78, 9), createdAt: "2026-11-11T10:00:00Z",
    ...over,
  };
}

describe("buildReportInput (what leaves the phone)", () => {
  it("passes the server schema, stays under the size cap and carries no name, age or camera", () => {
    const input = buildReportInput(session());
    const v = validateReportInput(JSON.parse(JSON.stringify(input)));
    expect(v.ok ? [] : v.errors).toEqual([]);
    const body = JSON.stringify(input);
    expect(new TextEncoder().encode(body).length).toBeLessThan(MAX_BODY_BYTES);
    expect(body).not.toContain("Maria");
    expect(body).not.toContain("Back Camera");
    expect(body).not.toContain('"age"');
    expect(input.ageBand).toBe("75-79");
  });

  it("handles refused and skipped tests and every age band", () => {
    const refused: TugEntry = { schemaVersion: 1, outcome: "refused", refusalReason: "second_person", totalSec: null, riskFlag: null, timingErrorSec: 0.04, medianFps: 25, gateLog: [] };
    for (const age of [45, 62, 78, 93, 101]) {
      const s = session({ tug: refused, chair: chairFor(age, 8), profile: { firstName: "", age, sex: "female", walkingAid: "none", heightCm: 150 } });
      const v = validateReportInput(JSON.parse(JSON.stringify(buildReportInput(s))));
      expect(v.ok ? [] : v.errors).toEqual([]);
    }
    const skipped = session({ tug: { skipped: true, reason: "user skipped" }, chair: undefined });
    const v = validateReportInput(JSON.parse(JSON.stringify(buildReportInput(skipped))));
    expect(v.ok ? [] : v.errors).toEqual([]);
  });

  it("the route answers it with a template plan when no key is set", async () => {
    const res = await POST(new Request("http://localhost/api/report", { method: "POST", body: JSON.stringify(buildReportInput(session())) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("template");
    expect(body.report.familySteps.length).toBeGreaterThan(0);
  });
});

describe("report route guards", () => {
  it("reads at most the cap, even without a content-length", async () => {
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 30; i++) c.enqueue(new Uint8Array(1000));
        c.close();
      },
    });
    const req = new Request("http://localhost/api/report", { method: "POST", body: big, duplex: "half" } as RequestInit);
    expect(await readCapped(req, 20_000)).toBeNull();
    expect(await readCapped(new Request("http://x/", { method: "POST", body: "{}" }), 20_000)).toBe("{}");
  });

  it("refuses cross-site browser requests, allows same-site and header-less ones", async () => {
    const mk = (origin?: string) =>
      new Request("http://upright.example/api/report", { method: "POST", body: "{}", headers: origin ? { origin, host: "upright.example" } : {} });
    expect(sameOrigin(mk("https://evil.example"))).toBe(false);
    expect(sameOrigin(mk("https://upright.example"))).toBe(true);
    expect(sameOrigin(mk())).toBe(true);
    expect((await POST(mk("https://evil.example"))).status).toBe(403);
  });

  it("rate limits per address and resets after the window", () => {
    const ok = makeRateLimiter(3, 1000);
    expect([ok("a", 0), ok("a", 1), ok("a", 2), ok("a", 3)]).toEqual([true, true, true, false]);
    expect(ok("b", 3)).toBe(true);
    expect(ok("a", 1001)).toBe(true);
    expect(clientKey(new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
  });

  it("the route returns 429 once an address goes over the limit", async () => {
    const req = () => new Request("http://localhost/api/report", { method: "POST", body: "{}", headers: { "x-forwarded-for": "9.9.9.9" } });
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await POST(req())).status);
    expect(codes.slice(0, 20).every((c) => c === 400)).toBe(true);
    expect(codes[21]).toBe(429);
  });
});
