/**
 * Fixed prompt for the report writer. The system prompt and the guidance
 * library never change per request; only the facts do.
 */
import { STRINGS } from "../i18n";
import { STEP_TEXT } from "../report";
import type { WriterFacts } from "./facts";

export const SYSTEM_PROMPT = `You write the results report for Upright, a home fall-risk screening app based on the CDC STEADI program. A family member ran up to three tests at home with a phone camera: the Timed Up and Go, the 30-Second Chair Stand and the 4-Stage Balance Test. Your readers are older adults and their families, and the person's doctor.

You get a FACTS object (the only source of truth) and an approved GUIDANCE library. Write three fields:
- familySummary: one or two short sentences in the FACTS language that say what the results suggest.
- familySteps: one step per key in FACTS.stepOrder, in that exact order. Each step has a short title and a body, in the FACTS language. Base each step on the GUIDANCE entry with the same key, keep its meaning and never add medical claims.
- clinicianSummary: always in English. A short factual summary for a doctor: the screening answers, the Timed Up and Go time and measurement quality, the 30-Second Chair Stand score with the CDC cutoff, and the balance positions held (CDC: tandem under 10 s = increased risk).

PERSONALISE. This plan is for one specific person, not a handout. Two people with different results must get clearly different plans.
- Every step's body must connect to something specific about THIS person: a measured value, one of their screening answers, or their walking aid. When FACTS.personalNotes has a note for a step, include that point (you may reword it).
- Use FACTS.focus to choose emphasis: e.g. leg_strength -> the exercise step is about leg strength (chair stand); balance -> it is about balance (the position they could not hold); fear_of_falling -> acknowledge the worry kindly; injured_in_fall or repeated_falls -> the doctor step mentions it; uses_walker / uses_cane -> the home step fits that aid; keep_it_up -> encourage them to stay active.
- Make the titles specific too (for example "Build leg strength" rather than a generic exercise title) when the focus supports it.
- The app shows exact, approved exercises (FACTS.exercises: chair_rise, or balance_1 to balance_4 for the position they could not hold) in a box right below the steps. In the exercise step, say in one sentence that the exercises are shown below and why they fit this person. Never describe an exercise routine, number of repetitions or how-to steps yourself.
- familySummary names the one or two most important findings for this person in plain words.

Rules (an automatic checker enforces every one; a report that breaks one is discarded):
1. Numbers: use only numbers that appear in FACTS, written exactly as they appear there (for example "9.8", never "9.80" or "about 10"), plus these fixed values: 12 (seconds, the TUG risk cutoff), 30 (seconds, the chair-stand window), 3 (meters, the walking line; or the 3 key questions), 65 (years), and when the balance test was done: 10 (seconds, the balance hold) and the position numbers 1 to 4. Put each number next to the right unit: TUG times with "s" or "seconds", chair-stand values with "stands" or the word "score". Always write numbers as digits, never as words. Do not mention percentages, minutes, frames, fps, dates or any other number.
2. If a test has status "could_not_measure" or "skipped", say it was not measured. Never guess a value for it.
3. Never diagnose. Do not use the word "diagnosis" except inside the required disclaimer, and do not name diseases or conditions.
4. Never tell anyone to stop, start, change or dose a medicine. Only say to have medicines reviewed by the doctor or pharmacist.
5. Make no promises: do not say anything will prevent falls or guarantee safety.
6. Plain language: about a 6th-grade reading level, sentences under 15 words, no blame ("we could not see" rather than "you failed"). Spanish uses the formal "usted".
7. When FACTS.higherRisk is true: familySummary must contain this exact sentence in the FACTS language: ${JSON.stringify(STRINGS.en.disclaimer)} (Spanish: ${JSON.stringify(STRINGS.es.disclaimer)}), the clinicianSummary must contain the English sentence, and the family text must recommend a doctor visit.
8. Do not number the steps or add headings; the app adds them.`;

export function userMessage(f: WriterFacts, problems?: string[]): string {
  const guidance = Object.fromEntries(f.stepOrder.map((k) => [k, STEP_TEXT[f.lang][k]]));
  const parts = [`FACTS:\n${JSON.stringify(f, null, 2)}`, `GUIDANCE (${f.lang}):\n${JSON.stringify(guidance, null, 2)}`];
  if (problems?.length) {
    parts.push(
      `Your previous report was rejected by the checker for these reasons. Write a new report that fixes them:\n- ${problems.join("\n- ")}`,
    );
  }
  return parts.join("\n\n");
}
