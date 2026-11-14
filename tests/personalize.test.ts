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

describe("why the standard plan was used", () => {
  it("an API failure is reported with its kind, a checker failure is not", async () => {
    const { generateReport } = await import("../lib/reportgen/generate");
    const input = load(files[0]);
    class AuthenticationError extends Error {
      status = 401;
      name = "AuthenticationError";
    }
    const bad = await generateReport(input, async () => {
      throw new AuthenticationError("invalid x-api-key");
    });
    expect(bad.source).toBe("template");
    expect(bad.modelError).toBe("AuthenticationError (401)");

    const unsafe = await generateReport(input, async () => ({
      familySummary: "You have a disease. Take 5 mg.",
      familySteps: [{ title: "x", body: "y" }],
      clinicianSummary: "z",
      exercises: [],
    }));
    expect(unsafe.source).toBe("template");
    expect(unsafe.modelError).toBeUndefined();
    expect(unsafe.rejected.length).toBe(2);
  });
});

describe("exercises for this person (Nov 14)", () => {
  it("the app's own pick follows the results, in both languages", async () => {
    const { exercisesFor } = await import("../lib/exercises");
    const base: PlanContext = {
      screening: { unsteady: false, worry: false, fallen: false, fallCount: null, injured: null },
      walkingAid: "none", tugSec: "9.8", tugAtRisk: false, chairScore: "13", chairNorm: "12", chairBelow: false, armsUsed: false,
      balance: { tandemHeld10: true, failedStage: null, failedHeldSec: null },
    };
    const legs = exercisesFor({ ...base, chairScore: "8", chairBelow: true }, "en");
    expect(legs.cards[0].id).toBe("chair_rise");
    expect(legs.cards[0].why).toContain("8 times");
    expect(legs.cards[0].dose).toContain("10 to 15");
    const bal = exercisesFor({ ...base, balance: { tandemHeld10: false, failedStage: 3, failedHeldSec: "6.4" } }, "en");
    expect(bal.cards.map((c) => c.id)).toContain("balance_3");
    expect(bal.cards.find((c) => c.id === "balance_3")!.why).toContain("position 3 for 6.4 seconds");
    expect(bal.safety.join(" ")).toContain("physical therapist");
    const good = exercisesFor(base, "es");
    expect(good.cards[0].id).toBe("chair_rise");
    expect(good.safety.join(" ")).not.toContain("fisioterapeuta");
    const both = exercisesFor({ ...base, armsUsed: true, balance: { tandemHeld10: false, failedStage: 2, failedHeldSec: "4.0" }, walkingAid: "walker" }, "en");
    expect(both.cards.map((c) => c.id)).toEqual(expect.arrayContaining(["seated_march", "chair_rise", "balance_2"]));
    expect(both.safety.join(" ")).toContain("walker");
  });
});

describe("exercise library and the AI's exercises", () => {
  const baseCtx: PlanContext = {
    screening: { unsteady: false, worry: false, fallen: false, fallCount: null, injured: null },
    walkingAid: "none", tugSec: "9.8", tugAtRisk: false, chairScore: "13", chairNorm: "12", chairBelow: false, armsUsed: false,
    balance: { tandemHeld10: true, failedStage: null, failedHeldSec: null },
  };
  it("every library entry, in both languages, passes the number and phrase checks and names a support", async () => {
    const { LIBRARY, EXERCISE_IDS, libraryNumbers } = await import("../lib/exercises");
    const { checkNumbers, checkPhrases } = await import("../lib/reportgen/check");
    const nums = libraryNumbers(EXERCISE_IDS);
    const set = { seconds: nums, stands: nums, meters: new Set<string>(), years: new Set<string>(), bare: nums };
    for (const lang of ["en", "es"] as const) {
      for (const id of EXERCISE_IDS) {
        const e = LIBRARY[lang][id];
        const text = [e.title, ...e.steps, e.dose, e.easier].join("\n");
        expect(checkNumbers(text, lang, set), `${lang} ${id}`).toEqual([]);
        expect(checkPhrases(text, lang), `${lang} ${id}`).toEqual([]);
        expect(e.steps.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("eligible exercises depend on the results (no one-foot stand for someone who failed an easier stance)", async () => {
    const { eligibleIds, suggestedIds } = await import("../lib/exercises");
    const failed = { ...baseCtx, balance: { tandemHeld10: false, failedStage: 2, failedHeldSec: "4.0" } };
    const ids = eligibleIds(failed);
    expect(ids).toEqual(expect.arrayContaining(["balance_2", "balance_1"]));
    expect(ids).not.toContain("balance_4");
    expect(ids).not.toContain("tandem_walk_counter");
    expect(eligibleIds(baseCtx)).toContain("balance_4");
    expect(eligibleIds({ ...baseCtx, armsUsed: true })).toContain("seated_march");
    for (const c of [baseCtx, failed, { ...baseCtx, chairBelow: true, balance: null }]) {
      const s = suggestedIds(c);
      expect(s.length).toBeGreaterThanOrEqual(3);
      expect(s.length).toBeLessThanOrEqual(4);
      expect(s.every((x) => eligibleIds(c).includes(x))).toBe(true);
    }
  });

  it("a writer's exercises are accepted from the library and rejected when invented or unsafe", async () => {
    const { checkReport } = await import("../lib/reportgen/check");
    const base = load(files[0]);
    const input: ReportInput = { ...base, balance: BALANCE.tandemFail, walkingAid: "walker" };
    const { facts, allowed } = writerFacts(input);
    const good = templateReport(facts);
    expect(checkReport(good, facts, allowed)).toEqual([]);
    expect(good.exercises.length).toBeGreaterThanOrEqual(3);
    const withEx = (e: Partial<(typeof good.exercises)[number]>, i = 0) => ({ ...good, exercises: good.exercises.map((x, k) => (k === i ? { ...x, ...e } : x)) });
    // an exercise that is not allowed for this person (one-foot stand after failing stage 3)
    expect(checkReport(withEx({ id: "balance_4" }), facts, allowed).join(" ")).toContain("not in the approved list");
    // an invented number of repetitions in the tip
    expect(checkReport(withEx({ tip: "Repeat 40 times." }), facts, allowed).join(" ")).toContain("40");
    // a library number is fine; a minute or a weight is not
    expect(checkReport(withEx({ tip: "Hold for up to 10 seconds." }), facts, allowed)).toEqual([]);
    expect(checkReport(withEx({ tip: "Use a 5 kg weight." }), facts, allowed).join(" ")).toContain("kg");
    // promise wording and an empty reason
    expect(checkReport(withEx({ why: "This will prevent falls." }), facts, allowed).join(" ")).toContain("promise");
    expect(checkReport(withEx({ why: "" }), facts, allowed).join(" ")).toContain("no reason");
    // too few
    expect(checkReport({ ...good, exercises: good.exercises.slice(0, 1) }, facts, allowed).join(" ")).toContain("need 3 or 4");
  });

  it("different people are offered different exercises in the writer's facts", () => {
    const base = load(files[0]);
    const a = writerFacts({ ...base, balance: BALANCE.tandemFail, walkingAid: "walker" }).facts;
    const b = writerFacts({ ...base, balance: BALANCE.allHeld, walkingAid: "none" }).facts;
    expect(a.suggestedExercises).toContain("balance_3");
    expect(b.suggestedExercises).not.toContain("balance_3");
    expect(a.suggestedExercises).not.toEqual(b.suggestedExercises);
  });
});
