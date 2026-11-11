import { describe, expect, it } from "vitest";
import { analyzeTug, buildChairResult, buildTugResult, type RunContext } from "../lib/analysis";
import type { GateEvent } from "../lib/contract";
import { GateLogger, gateOffMs } from "../lib/signal/gate";
import { TUG } from "../lib/signal/thresholds";
import { body, chairPath, lerp, stream, tugPath } from "./synth";

const ev = (t: number, gate: GateEvent["gate"], ok: boolean): GateEvent => ({ t, gate, ok });
const clean = (): GateEvent[] => [ev(-3000, "body", true), ev(-3000, "one_person", true), ev(-3000, "fps", true)];
const ctx = (over: Partial<RunContext> = {}): RunContext => ({ medianFps: 30, gateLog: clean(), ...over });

const tugStream = () => stream(tugPath, 12, 0.5);
const chairStream = (armsLow = false) => stream(chairPath(armsLow), 31, 0.5);
const person = { age: 72, sex: "female" as const };

describe("gate log", () => {
  it("records only transitions, with each gate's first state", () => {
    const g = new GateLogger();
    g.update("body", true, 100);
    g.update("body", true, 200);
    g.update("body", false, 300);
    g.update("body", true, 400);
    expect(g.events.map((e) => [e.t, e.ok])).toEqual([[100, true], [300, false], [400, true]]);
  });
  it("re-bases times to the Go cue", () => {
    const g = new GateLogger();
    g.update("fps", true, 1000);
    expect(g.relativeTo(4000)[0].t).toBe(-3000);
  });
  it("sums the time a gate was off inside a window", () => {
    const log = [ev(-1000, "body", true), ev(2000, "body", false), ev(3500, "body", true)];
    expect(gateOffMs(log, "body", 0, 10_000)).toBe(1500);
    expect(gateOffMs(log, "body", 2500, 3000)).toBe(500); // window fully inside the off span
    expect(gateOffMs(log, "body", 4000, 5000)).toBe(0);
  });
  it("counts a gate that is off from before the window", () => {
    expect(gateOffMs([ev(-500, "one_person", false)], "one_person", 0, 1000)).toBe(1000);
  });
  it("a gate that never logged cannot refuse a test", () => {
    expect(gateOffMs([], "body", 0, 10_000)).toBe(0);
  });
});

describe("TUG quality outcomes", () => {
  it("Full when every gate held", () => {
    const r = buildTugResult(tugStream(), ctx());
    expect(r.outcome).toBe("full");
    expect(r.schemaVersion).toBe(1);
    expect(r.totalSec).toBeGreaterThan(9.3);
    expect(r.totalSec).toBeLessThan(9.9);
    expect(r.riskFlag).toBe(false);
    expect(r.phases).toBeDefined();
    expect(r.timingErrorSec).toBeCloseTo(1 / 30, 3);
  });

  it("Total only when the body gate drops mid-walk", () => {
    const r = buildTugResult(tugStream(), ctx({ gateLog: [...clean(), ev(4000, "body", false), ev(4900, "body", true)] }));
    expect(r.outcome).toBe("total_only");
    expect(r.totalSec).not.toBeNull();
    expect(r.phases).toBeUndefined(); // phases hidden unless Full
  });

  it("a TUG with the 3 m mark out of frame cannot return Full", () => {
    const r = buildTugResult(tugStream(), ctx({ markVisible: false }));
    expect(r.outcome).toBe("total_only");
    expect(r.phases).toBeUndefined();
  });

  it("an unrecorded mark (null) does not block Full", () => {
    expect(buildTugResult(tugStream(), ctx({ markVisible: null })).outcome).toBe("full");
  });

  it("Refused (no number) when the body is not visible at the start", () => {
    const r = buildTugResult(tugStream(), ctx({ gateLog: [...clean(), ev(100, "body", false), ev(900, "body", true)] }));
    expect(r.outcome).toBe("refused");
    expect(r.refusalReason).toBe("not_visible_at_start_or_end");
  });

  it("Refused when the body is not visible at the final sit", () => {
    const r = buildTugResult(tugStream(), ctx({ gateLog: [...clean(), ev(9300, "body", false)] }));
    expect(r.outcome).toBe("refused");
    expect(r.refusalReason).toBe("not_visible_at_start_or_end");
  });

  it("Refused for a second person in view for more than 0.5 s", () => {
    const r = buildTugResult(tugStream(), ctx({ gateLog: [...clean(), ev(3000, "one_person", false), ev(3800, "one_person", true)] }));
    expect(r.refusalReason).toBe("second_person");
    expect(r.outcome).toBe("refused");
  });

  it("does not refuse for a brief second-person blip", () => {
    const r = buildTugResult(tugStream(), ctx({ gateLog: [...clean(), ev(3000, "one_person", false), ev(3300, "one_person", true)] }));
    expect(r.outcome).toBe("full");
  });

  it("Refused for low fps, abort and hidden tab", () => {
    expect(buildTugResult(tugStream(), ctx({ medianFps: 12 })).refusalReason).toBe("fps_low");
    expect(buildTugResult(tugStream(), ctx({ medianFps: null })).refusalReason).toBe("fps_low");
    expect(buildTugResult(tugStream(), ctx({ aborted: true })).refusalReason).toBe("aborted");
    expect(buildTugResult(tugStream(), ctx({ tabHidden: true })).refusalReason).toBe("tab_hidden");
  });

  it("a refused TUG never carries a number, risk flag or phases", () => {
    for (const r of [
      buildTugResult(tugStream(), ctx({ medianFps: 10 })),
      buildTugResult(tugStream(), ctx({ aborted: true })),
    ]) {
      expect(r.outcome).toBe("refused");
      expect(r.totalSec).toBeNull();
      expect(r.riskFlag).toBeNull();
      expect(r.phases).toBeUndefined();
    }
  });

  it("Refused when no total can be found (stands and sits, never walks)", () => {
    const s = (t: number) => body(200, t < 1 ? 90 : t < 2 ? lerp(90, 0, t - 1) : t < 3 ? lerp(0, 90, t - 2) : 90);
    const r = buildTugResult(stream(s, 8, 0.5), ctx());
    expect(r.outcome).toBe("refused");
    expect(r.totalSec).toBeNull();
  });

  it("flags risk at 12 s or more", () => {
    // 1.4x slower walker: ~13.4 s
    const r = buildTugResult(stream((t) => tugPath(t / 1.4), 20, 0.5), ctx());
    expect(r.totalSec).toBeGreaterThanOrEqual(12);
    expect(r.riskFlag).toBe(true);
  });
});

describe("TUG hard limit", () => {
  it("stops and refuses a run that takes longer than the 60 s limit", () => {
    expect(TUG.timeoutMs).toBe(60_000);
    const slow = stream((t) => tugPath(t / 7), 80, 0.5); // ~70 s
    expect(analyzeTug(slow)).toBeNull();
    expect(buildTugResult(slow, ctx()).outcome).toBe("refused");
  });
  it("still scores a slow but legitimate run (~50 s)", () => {
    const r = analyzeTug(stream((t) => tugPath(t / 5), 70, 0.5));
    expect(r).not.toBeNull();
    expect(r!.totalS).toBeLessThan(60);
  });
});

describe("chair-stand quality outcomes", () => {
  it("Full with the stand count and CDC norm", () => {
    const r = buildChairResult(chairStream(), ctx(), person);
    expect(r.outcome).toBe("full");
    expect(r.stands).toBe(12);
    expect(r.armUse).toBe(false);
    expect(r.belowNorm).toBe(false); // 12 >= 10 for a 72-year-old woman
  });

  it("arm use scores 0 against the norm even with stands counted", () => {
    const r = buildChairResult(chairStream(true), ctx(), person);
    expect(r.armUse).toBe(true);
    expect(r.belowNorm).toBe(true);
  });

  it("Refused when the body was out of view for more than 10% of the 30 s window", () => {
    const r = buildChairResult(chairStream(), ctx({ gateLog: [...clean(), ev(5000, "body", false), ev(9000, "body", true)] }), person);
    expect(r.outcome).toBe("refused");
    expect(r.stands).toBeNull();
    expect(r.belowNorm).toBeNull();
  });

  it("tolerates a short body-gate drop", () => {
    const r = buildChairResult(chairStream(), ctx({ gateLog: [...clean(), ev(5000, "body", false), ev(6000, "body", true)] }), person);
    expect(r.outcome).toBe("full");
  });

  it("Refused for low fps, second person, abort", () => {
    expect(buildChairResult(chairStream(), ctx({ medianFps: 9 }), person).refusalReason).toBe("fps_low");
    expect(
      buildChairResult(chairStream(), ctx({ gateLog: [...clean(), ev(1000, "one_person", false)] }), person).refusalReason,
    ).toBe("second_person");
    expect(buildChairResult(chairStream(), ctx({ aborted: true }), person).outcome).toBe("refused");
  });

  it("returns no norm outside the CDC table", () => {
    const r = buildChairResult(chairStream(), ctx(), { age: 55, sex: "male" });
    expect(r.outcome).toBe("full");
    expect(r.belowNorm).toBeNull();
  });
});
