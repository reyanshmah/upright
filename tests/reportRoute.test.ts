import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/report/route";
import { STRINGS } from "../lib/i18n";
import { checkReport } from "../lib/reportgen/check";
import { writerFacts } from "../lib/reportgen/facts";
import { generateReport, type CallModel } from "../lib/reportgen/generate";
import { validateReportInput, type ReportInput, type ReportOutput } from "../lib/reportgen/schema";
import { templateReport } from "../lib/reportgen/template";

const DIR = join(__dirname, "fixtures", "report");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as ReportInput;
const fixture = (prefix: string) => load(files.find((f) => f.startsWith(prefix))!);

/** Expected "any risk flag" for each fixture, worked out by hand from the CDC rules. */
const HIGHER_RISK: Record<string, boolean> = {
  "01": false, "02": false, "03": true, "04": true, "05": false, "06": true, "07": true, "08": true, "09": false, "10": true,
  "11": true, "12": true, "13": false, "14": false, "15": true, "16": true, "17": true, "18": false, "19": false, "20": true,
};

const post = (body: string) => POST(new Request("http://localhost/api/report", { method: "POST", body }));

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "")); // tests never call the real API
afterEach(() => vi.unstubAllEnvs());

describe("20 fixed results JSONs", () => {
  it("there are exactly 20", () => expect(files).toHaveLength(20));

  for (const f of files) {
    describe(f, () => {
      const input = load(f);
      it("passes the schema", () => {
        const v = validateReportInput(input);
        expect(v.ok ? [] : v.errors).toEqual([]);
      });
      it("sets the expected risk flag", () => {
        expect(writerFacts(input).facts.higherRisk).toBe(HIGHER_RISK[f.slice(0, 2)]);
      });
      it("the template fallback passes every check", () => {
        const { facts, allowed } = writerFacts(input);
        expect(checkReport(templateReport(facts), facts, allowed)).toEqual([]);
      });
      it("a model report that passes the checks is used as written", async () => {
        const { facts } = writerFacts(input);
        const good = templateReport(facts);
        const r = await generateReport(input, async () => good);
        expect(r.source).toBe("model");
        expect(r.report).toEqual(good);
      });
      it("the route answers 200 with the template when no API key is set", async () => {
        const res = await post(JSON.stringify(input));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.source).toBe("template");
        expect(body.lang).toBe(input.lang);
        if (HIGHER_RISK[f.slice(0, 2)]) expect(body.report.familySummary).toContain(STRINGS[input.lang].disclaimer);
      });
    });
  }

  it("a test that was not measured carries no number in the template", () => {
    const r = templateReport(writerFacts(fixture("05")).facts); // TUG refused
    expect(r.clinicianSummary).toMatch(/Timed Up and Go: could not be measured/);
    const r2 = templateReport(writerFacts(fixture("08")).facts); // both skipped
    expect(r2.clinicianSummary).toMatch(/Timed Up and Go: not done\..*Chair Stand: not done/);
  });
});

describe("route input validation", () => {
  const base = () => fixture("03");
  it("400 on a body that is not JSON", async () => expect((await post("{nope")).status).toBe(400));
  it("413 on an oversized body", async () => expect((await post(" ".repeat(20_001))).status).toBe(413));
  const bad: [string, (x: Record<string, any>) => void][] = [
    ["a name", (x) => (x.firstName = "Ana")],
    ["an exact age", (x) => (x.age = 72)],
    ["a TUG under 2 s", (x) => Object.assign(x.tug, { totalSec: 1.5, riskFlag: false })],
    ["a TUG over 60 s", (x) => Object.assign(x.tug, { totalSec: 75, riskFlag: true })],
    ["more than 40 stands", (x) => (x.chair.stands = 41)],
    ["a risk flag that contradicts the time", (x) => (x.tug.riskFlag = false)],
    ["a refused TUG that still has a number", (x) => Object.assign(x.tug, { outcome: "refused" })],
    ["a below-norm flag that contradicts the CDC table", (x) => (x.chair.belowNorm = true)],
    ["phases on a total-only TUG", (x) => (x.tug.outcome = "total_only")],
    ["an unknown language", (x) => (x.lang = "fr")],
  ];
  for (const [what, mutate] of bad) {
    it(`400 for ${what}`, async () => {
      const x = base() as unknown as Record<string, any>;
      mutate(x);
      const res = await post(JSON.stringify(x));
      expect(res.status).toBe(400);
      expect((await res.json()).details.length).toBeGreaterThan(0);
    });
  }
});

describe("bad model outputs are rejected", () => {
  // 03: English, TUG 13.4 s (at risk), chair stand 12 (cutoff 10). 04: Spanish, TUG 11.2 s total only, chair 8.
  const en = fixture("03");
  const es = fixture("04");
  const reject = (input: ReportInput, edit: (o: ReportOutput) => void) => {
    const { facts, allowed } = writerFacts(input);
    const out = structuredClone(templateReport(facts));
    expect(checkReport(out, facts, allowed)).toEqual([]); // the unedited text passes
    edit(out);
    return checkReport(out, facts, allowed);
  };
  const addFamily = (s: string) => (o: ReportOutput) => (o.familySummary += ` ${s}`);

  it("1. an invented number", () => {
    expect(reject(en, addFamily("The walk took 11.2 seconds.")).join()).toMatch(/11\.2/);
  });
  it("2. a right number in the wrong place (the TUG time as a stand count)", () => {
    expect(reject(en, addFamily("They stood up 13.4 times.")).join()).toMatch(/13\.4 times.*stands value/);
  });
  it("3. a spelled-out 'twelve'", () => {
    expect(reject(en, addFamily("The cutoff is twelve seconds.")).join()).toMatch(/spelled-out number "twelve"/);
  });
  it("4. a wrong unit", () => {
    expect(reject(en, addFamily("The walk took 13.4 minutes.")).join()).toMatch(/unit "minutes"/);
  });
  it("5. a spelled-out number in Spanish ('doce segundos')", () => {
    expect(reject(es, addFamily("El límite es doce segundos.")).join()).toMatch(/"doce"/);
  });
  it("6. diagnosis wording", () => {
    expect(reject(en, (o) => (o.clinicianSummary += " Diagnosis: gait disorder.")).join()).toMatch(/diagnosis wording/);
  });
  it("7. telling them to stop a medicine (Spanish)", () => {
    expect(reject(es, addFamily("Deje de tomar las pastillas para dormir.")).join()).toMatch(/medicine change/);
  });
  it("8. dosing advice", () => {
    expect(reject(en, addFamily("Lower the dose of the blood pressure pills.")).join()).toMatch(/dosing|medicine change/);
  });
  it("9. a promise", () => {
    expect(reject(en, addFamily("These exercises will prevent falls.")).join()).toMatch(/promise/);
  });
  it("10. the disclaimer missing when a risk flag is set", () => {
    const d = STRINGS.en.disclaimer;
    expect(reject(en, (o) => (o.familySummary = o.familySummary.replace(d, ""))).join()).toMatch(/disclaimer is missing/);
  });
});

describe("regenerate once, then the template", () => {
  const input = fixture("03");
  const { facts } = writerFacts(input);
  const good = templateReport(facts);
  const bad: ReportOutput = { ...good, familySummary: `${good.familySummary} It took 99 seconds.` };

  it("bad then good -> regenerated, and the retry is told why", async () => {
    const calls: string[] = [];
    const model: CallModel = async (req) => (calls.push(req.user), calls.length === 1 ? bad : good);
    const r = await generateReport(input, model);
    expect(r.source).toBe("regenerated");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/rejected by the checker[\s\S]*"99 seconds" is not a seconds value/);
  });
  it("bad twice -> template, never a third call", async () => {
    const model = vi.fn<CallModel>(async () => bad);
    const r = await generateReport(input, model);
    expect(r.source).toBe("template");
    expect(model).toHaveBeenCalledTimes(2);
    expect(r.rejected).toHaveLength(2);
    expect(r.report).toEqual(good);
  });
  it("a refusal / unparseable output counts as a failure", async () => {
    expect((await generateReport(input, async () => null)).source).toBe("template");
  });
  it("a network error or timeout falls back to the template", async () => {
    const r = await generateReport(input, async () => {
      throw new Error("timeout");
    });
    expect(r.source).toBe("template");
    expect(r.rejected[0][0]).toMatch(/model call failed/);
  });
  it("no second attempt when the 15 s budget is used up", async () => {
    let t = 0;
    const model = vi.fn<CallModel>(async () => ((t += 14_000), bad));
    const r = await generateReport(input, model, () => t);
    expect(model).toHaveBeenCalledTimes(1);
    expect(r.source).toBe("template");
  });
  it("passes the remaining budget to the model call as its timeout", async () => {
    const model = vi.fn<CallModel>(async () => good);
    await generateReport(input, model, () => 0);
    expect(model.mock.calls[0][0].timeoutMs).toBe(15_000);
  });
  it("no model configured -> template without calling anything", async () => {
    expect((await generateReport(input, null)).source).toBe("template");
  });
});

describe("number check edge cases", () => {
  const { facts, allowed } = writerFacts(fixture("07")); // arms used: score 0
  it("'scored 0 per the CDC form' is fine; '30 per cent' is not", () => {
    const base = templateReport(facts);
    expect(checkReport(base, facts, allowed)).toEqual([]);
    const out = { ...base, familySummary: `${base.familySummary} Risk is 30 per cent higher.` };
    expect(checkReport(out, facts, allowed).join()).toMatch(/unit "%"/);
  });
});
