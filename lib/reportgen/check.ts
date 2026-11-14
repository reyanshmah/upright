/**
 * Checks on model-written report text (MASTER.md "Report pipeline" steps 4-5).
 * Any problem fails the output; the pipeline then regenerates once and, on a
 * second failure, uses the deterministic template. The person never sees a
 * failed output.
 *
 *  - Number check: every numeral must be a value from the facts, in the
 *    engine's own format ("9.8", not "9.80" or "ten"), with a unit that fits
 *    it: a time only next to "seconds", a count only next to "stands", etc.
 *    Spelled-out numbers are never allowed (the engine prints digits).
 *  - Phrase check: no diagnosis wording, no medicine changes or doses, no
 *    promises.
 *  - Risk: when any risk flag is set, the exact disclaimer and a doctor visit
 *    must both appear.
 */
import { libraryNumbers, type ExerciseId } from "../exercises";
import { STRINGS, type Lang } from "../i18n";
import type { AllowedNumbers, WriterFacts } from "./facts";
import type { ReportOutput } from "./schema";

type UnitClass = keyof AllowedNumbers | "forbidden";

const UNITS: [RegExp, UnitClass][] = [
  [/^(s|sec|secs|second|seconds|seg|segundo|segundos)$/i, "seconds"],
  [/^(stand|stands|rise|rises|times|repetitions|veces|vez|levantadas?|repeticiones)$/i, "stands"],
  [/^(m|meter|meters|metre|metres|metro|metros)$/i, "meters"],
  [/^(year|years|yr|yrs|año|años)$/i, "years"],
  [
    /^(%|percent|porcentaje|min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas|day|days|día|días|week|weeks|semana|semanas|month|months|mes|meses|mg|g|kg|lb|lbs|ml|cm|mm|km|ft|feet|foot|in|inch|inches|mph|pulgadas|pies)$/i,
    "forbidden",
  ],
];

/** Number words that must never appear ("one"/"uno"/"una" are left out: too common as words). */
const NUMBER_WORDS: Record<Lang, RegExp> = {
  en: /\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen)\b/i,
  es: /(?<![\p{L}])(cero|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciséis|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mil|docena)(?![\p{L}])/iu,
};

const BANNED: Record<Lang, [RegExp, string][]> = {
  en: [
    [/\bdiagnos\w*/i, "diagnosis wording"],
    [/\b(you|he|she|they) (have|has) (a |an )?(disease|disorder|condition|osteoporosis|parkinson\w*|dementia|neuropathy)\b/i, "diagnosis wording"],
    // "Do not stop any medicine on your own" is the approved safety line, so negated forms pass.
    [/(?<!\b(?:not|never)\s|n't\s)\b(stop|quit|discontinue|skip)\w* (taking |using )?(\w+ )?(medicine|medicines|medication|medications|pills?|drugs?)\b/i, "medicine change"],
    [/(?<!\b(?:not|never)\s|n't\s)\bstop taking\b/i, "medicine change"],
    [/\b(dose|doses|dosage|dosing)\b/i, "dosing"],
    [/\b(reduce|lower|increase|raise|cut|change|adjust|double|halve)\w* (your |the |his |her |their )?(\w+ )?(\w+ )?(medicine|medicines|medication|medications|pills?|drugs?)\b/i, "medicine change"],
    [/\bwill (prevent|stop|eliminate|end)\b/i, "promise"],
    [/\bguarantee\w*/i, "promise"],
    [/\b(cure|cures|cured)\b/i, "promise"],
    [/\b(never|will not|won't) fall\b/i, "promise"],
    [/\bno (risk|chance) of falling\b/i, "promise"],
  ],
  es: [
    [/diagn[oó]s?tic\w*/i, "diagnosis wording"],
    [/\b(tiene|padece|sufre de) (una |un )?(enfermedad|trastorno|osteoporosis|parkinson|demencia|neuropat\w+)/i, "diagnosis wording"],
    [/\bdej\w* de tomar\b/i, "medicine change"],
    [/\b(suspend|interrump)\w* (\w+ ){0,2}(medicament|medicina|pastilla)\w*/i, "medicine change"],
    [/\bdosis\b/i, "dosing"],
    [/\b(reduzca|baje|aumente|suba|cambie|ajuste|duplique|reduzcan|bajen|aumenten)\b (\w+ ){0,2}(medicament|medicina|pastilla)\w*/i, "medicine change"],
    [/\b(prevendr\w+|evitar[áa]n?)\b/i, "promise"],
    [/\bgarantiz\w*/i, "promise"],
    [/\b(cura|curar\w*|curará)\b/i, "promise"],
    [/\bnunca (se )?(caer\w*|caiga\w*)\b/i, "promise"],
  ],
};

const DOCTOR: Record<Lang, RegExp> = {
  en: /\b(doctor|physician|clinician)\b/i,
  es: /\b(médic[oa]|medic[oa]|doctor[a]?)\b/i,
};

/** The word or symbol right after a numeral ("12-second" -> "second", "30 %" -> "%"). */
function unitAfter(rest: string): string | null {
  if (/^\s*(por|per)\s+(ciento|cent)\b/i.test(rest)) return "%";
  const m = /^\s*[-–]?\s*(%|[\p{L}]+)/u.exec(rest);
  return m ? m[1] : null;
}

function classify(unit: string | null): UnitClass {
  if (!unit) return "bare";
  for (const [re, cls] of UNITS) if (re.test(unit)) return cls;
  return "bare";
}

/** Problems with the numbers in one piece of text. */
export function checkNumbers(text: string, lang: Lang, allowed: AllowedNumbers): string[] {
  const problems: string[] = [];
  const words = NUMBER_WORDS[lang].exec(text);
  if (words) problems.push(`spelled-out number "${words[0]}" (write digits)`);
  for (const m of text.matchAll(/(?<![\d.,])\d+(?:[.,]\d+)?/g)) {
    const raw = m[0];
    const value = raw.replace(",", ".");
    const unit = unitAfter(text.slice(m.index! + raw.length));
    const cls = classify(unit);
    if (cls === "forbidden") {
      problems.push(`"${raw}" with unit "${unit}" is not a measured value`);
    } else if (!allowed[cls].has(value)) {
      problems.push(
        cls === "bare" ? `invented number "${raw}"` : `"${raw} ${unit}" is not a ${cls} value from the results`,
      );
    }
  }
  return problems;
}

/** Problems with forbidden phrases (the required disclaimer itself is removed first). */
export function checkPhrases(text: string, lang: Lang): string[] {
  const cleaned = text.split(STRINGS[lang].disclaimer).join(" ").split(STRINGS.en.disclaimer).join(" ");
  const problems: string[] = [];
  for (const [re, why] of BANNED[lang]) {
    const m = re.exec(cleaned);
    if (m) problems.push(`${why}: "${m[0]}"`);
  }
  return problems;
}

/** Problems with the exercises: only library ids for this person, and a clean why and tip (the steps are the library's). */
export function checkExercises(out: ReportOutput, facts: WriterFacts, allowed: AllowedNumbers): string[] {
  const lang = facts.lang;
  const problems: string[] = [];
  const list = out.exercises ?? [];
  if (list.length < 3 || list.length > 4) problems.push(`exercises: need 3 or 4, got ${list.length}`);
  const seen = new Set<string>();
  const ok = new Set<string>(facts.eligibleExercises);
  const lib = libraryNumbers(facts.eligibleExercises as ExerciseId[]);
  const merged: AllowedNumbers = {
    seconds: new Set([...allowed.seconds, ...lib]),
    stands: new Set([...allowed.stands, ...lib]),
    meters: allowed.meters,
    years: allowed.years,
    bare: new Set([...allowed.bare, ...lib]),
  };
  for (const e of list) {
    if (!ok.has(e.id)) problems.push(`exercises: "${e.id}" is not in the approved list for this person`);
    if (seen.has(e.id)) problems.push(`exercises: "${e.id}" is repeated`);
    seen.add(e.id);
    if (!e.why.trim()) problems.push(`exercises: "${e.id}" has no reason`);
    const text = [e.why, e.tip].join("\n");
    if (text.length > 700) problems.push(`exercises: "${e.id}" is too long`);
    problems.push(...checkNumbers(text, lang, merged).map((p) => `exercises ${e.id}: ${p}`));
    problems.push(...checkPhrases(text, lang).map((p) => `exercises ${e.id}: ${p}`));
  }
  return problems;
}

/** All problems with a model-written report. Empty = it may be shown. */
export function checkReport(out: ReportOutput, facts: WriterFacts, allowed: AllowedNumbers): string[] {
  const lang = facts.lang;
  const family = [out.familySummary, ...out.familySteps.flatMap((s) => [s.title, s.body])].join("\n");
  const clinician = out.clinicianSummary;
  const problems = [
    ...checkNumbers(family, lang, allowed).map((p) => `family: ${p}`),
    ...checkPhrases(family, lang).map((p) => `family: ${p}`),
    ...checkNumbers(clinician, "en", allowed).map((p) => `clinician: ${p}`),
    ...checkPhrases(clinician, "en").map((p) => `clinician: ${p}`),
  ];
  problems.push(...checkExercises(out, facts, allowed));
  if (!out.familySteps.length) problems.push("family: no action steps");
  if (out.familySteps.length > 6) problems.push("family: more than 6 steps");
  if (family.length > 3000 || clinician.length > 2000) problems.push("too long");
  if (facts.higherRisk) {
    if (!family.includes(STRINGS[lang].disclaimer)) problems.push("family: risk flag set but the disclaimer is missing");
    if (!clinician.includes(STRINGS.en.disclaimer)) problems.push("clinician: risk flag set but the disclaimer is missing");
    if (!DOCTOR[lang].test(family)) problems.push("family: risk flag set but no doctor visit is recommended");
  }
  return problems;
}
