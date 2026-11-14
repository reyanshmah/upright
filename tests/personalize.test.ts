import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkReport } from "../lib/reportgen/check";
import { writerFacts } from "../lib/reportgen/facts";
import { validateReportInput, type ReportInput } from "../lib/reportgen/schema";
import { templateReport } from "../lib/reportgen/template";
import { STEP_TEXT, exerciseTitle, focusAreas, stepDetail, type PlanContext } from "../lib/report";

// The 20 report fixtures are read, never edited; balance and walking aid are added in memory.
const DIR = join(__dirname, "fixtures", "report");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as ReportInput;

const BALANCE = {
  none: undefined,
  skipped: { skipped: true as const },
  allHeld: {
    stages: [1, 2, 3, 4].map((stage) => ({ stage, heldSec: 10, completed: true })),
    tandemHeld10: true,
  },
  tandemFail: {
    stages: [
      { stage: 1, heldSec: 10, completed: true },
      { stage: 2, heldSec: 10, completed: true },
      { stage: 3, heldSec: 6.4, completed: false },
    ],
    tandemHeld10: false,
  },
  firstFail: { stages: [{ stage: 1, heldSec: 3.2, completed: false }], tandemHeld10: false },
};

describe("balance in the report request (Nov 14)", () => {
  const base = load(files[0]);
  it("accepts a measured or skipped balance test and a walking aid", () => {
    for (const b of Object.values(BALANCE)) {
      const v = validateReportInput({ ...base, ...(b ? { balance: b } : {}), walkingAid: "walker" });
      expect(v.ok ? [] : v.errors).toEqual([]);
    }
  });
  it("rejects a tandem flag that doesn't match the positions", () => {
    const v = validateReportInput({ ...base, balance: { ...BALANCE.tandemFail, tandemHeld10: true } });
    expect(v.ok).toBe(false);
  });
  it("a tandem under 10 s raises the risk flag", () => {
    expect(writerFacts({ ...base, balance: BALANCE.tandemFail }).facts.higherRisk).toBe(true);
    expect(writerFacts({ ...base, balance: BALANCE.allHeld }).facts.higherRisk).toBe(false);
  });
});

describe("personal notes always pass the AI number/phrase checker", () => {
  // If the AI reuses a note word for word, the draft must not be thrown out.
  for (const f of files) {
    for (const [bName, b] of Object.entries(BALANCE)) {
      for (const aid of ["none", "cane", "walker"] as const) {
        it(`${f} + balance ${bName} + ${aid}`, () => {
          const input: ReportInput = { ...load(f), ...(b ? { balance: b } : {}), walkingAid: aid };
          const { facts, allowed } = writerFacts(input);
          const out = templateReport(facts);
          out.familySteps = facts.stepOrder.map((k) => ({
            title: STEP_TEXT[facts.lang][k].title,
            body: [facts.personalNotes[k], STEP_TEXT[facts.lang][k].body].filter(Boolean).join(" "),
          }));
          expect(checkReport(out, facts, allowed)).toEqual([]);
        });
      }
    }
  }
});

describe("different people get different plans", () => {
  const ctx = (over: Partial<PlanContext>): PlanContext => ({
    screening: { unsteady: false, worry: false, fallen: false, fallCount: null, injured: null },
    walkingAid: "none",
    tugSec: "9.8",
    tugAtRisk: false,
    chairScore: "13",
    chairNorm: "12",
    chairBelow: false,
    armsUsed: false,
    balance: { tandemHeld10: true, failedStage: null, failedHeldSec: null },
    ...over,
  });
  const weakLegs = ctx({ chairScore: "8", chairNorm: "12", chairBelow: true });
  const weakBalance = ctx({ balance: { tandemHeld10: false, failedStage: 3, failedHeldSec: "6.4" } });
  const worriedFaller = ctx({ screening: { unsteady: true, worry: true, fallen: true, fallCount: "2", injured: true }, walkingAid: "walker" });

  it("the exercise step names strength or balance from what was weak", () => {
    expect(exerciseTitle(weakLegs, "en")).toBe("Build leg strength");
    expect(exerciseTitle(weakBalance, "en")).toBe("Practice balance exercises");
    expect(stepDetail("exercise", weakLegs, "en")).toContain("8 times");
    expect(stepDetail("exercise", weakBalance, "en")).toContain("position 3 for 6.4 seconds");
  });

  it("the doctor and home steps speak to falls, worry and a walker", () => {
    expect(stepDetail("doctor", worriedFaller, "en")).toContain("where you were hurt");
    expect(stepDetail("doctor", worriedFaller, "en")).toContain("worry about falling");
    expect(stepDetail("home", worriedFaller, "en")).toContain("walker");
    expect(stepDetail("doctor", weakLegs, "en")).toBeNull();
  });

  it("focus areas differ, and Spanish notes exist for the same cases", () => {
    expect(focusAreas(weakLegs)).toContain("leg_strength");
    expect(focusAreas(weakBalance)).toContain("balance");
    expect(focusAreas(worriedFaller)).toEqual(expect.arrayContaining(["fear_of_falling", "injured_in_fall", "repeated_falls", "uses_walker"]));
    expect(focusAreas(ctx({}))).toEqual(["keep_it_up"]);
    expect(stepDetail("exercise", weakLegs, "es")).toContain("8 veces");
  });

  it("the AI is given each person's notes and focus", () => {
    const base = load(files[0]);
    const a = writerFacts({ ...base, balance: BALANCE.tandemFail, walkingAid: "walker" }).facts;
    const b = writerFacts({ ...base, balance: BALANCE.allHeld, walkingAid: "none" }).facts;
    expect(a.focus).toContain("balance");
    expect(b.focus).not.toContain("balance");
    expect(JSON.stringify(a.personalNotes)).not.toEqual(JSON.stringify(b.personalNotes));
  });
});
