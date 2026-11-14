/**
 * Template report: the guaranteed fallback the plan requires. A later Claude
 * version may rewrite the wording, but must only use numbers from
 * ReportFacts, and every number in its output gets checked against them.
 *
 * Prevention steps follow CDC STEADI's areas (talk to the doctor, review
 * medicines, strength and balance exercise, home safety). Rules: a higher-risk
 * result always recommends a doctor visit; never suggest stopping a medicine.
 */
import type { Lang } from "./i18n";
import { chairMeasured, isSkipped, screenedAtRisk, tugMeasured, type SessionState } from "./session";
import { scoreChairStand, tugAtRisk } from "./signal/thresholds";

export type StepKey = "doctor" | "exercise" | "meds" | "home" | "repeat";

export interface ReportFacts {
  screenedAtRisk: boolean;
  tugS: number | null;
  tugAtRisk: boolean | null;
  chairScore: number | null;
  chairNorm: number | null;
  chairBelow: boolean | null;
  armsUsed: boolean | null;
  /** null = balance test not done */
  balanceAtRisk: boolean | null;
  injuredFall: boolean;
  multipleFalls: boolean;
  higherRisk: boolean;
}

export function reportFacts(s: SessionState): ReportFacts {
  // Refused tests carry no number, so they never reach the report.
  const tug = tugMeasured(s.tug);
  const chair = chairMeasured(s.chair);
  const sc = chair ? scoreChairStand(chair.stands, chair.armUse, s.profile.age, s.profile.sex) : null;
  const bal = s.balance && !isSkipped(s.balance) ? s.balance : null;
  const balRisk = bal ? !bal.tandemHeld10 : null;
  const screen = screenedAtRisk(s.screening);
  const tRisk = tug ? tugAtRisk(tug.totalSec) : null;
  const cBelow = sc ? sc.belowAverage : null;
  return {
    screenedAtRisk: screen,
    tugS: tug ? tug.totalSec : null,
    tugAtRisk: tRisk,
    chairScore: sc ? sc.score : null,
    chairNorm: sc ? sc.norm : null,
    chairBelow: cBelow,
    armsUsed: chair ? chair.armUse : null,
    balanceAtRisk: balRisk,
    injuredFall: !!s.screening.injured,
    multipleFalls: s.screening.fallCount === "2" || s.screening.fallCount === "3+",
    higherRisk: screen || tRisk === true || cBelow === true || balRisk === true,
  };
}

/** Order of the family action steps. */
export function stepOrder(f: ReportFacts): StepKey[] {
  if (!f.higherRisk) return ["exercise", "home", "repeat"];
  const order: StepKey[] = ["doctor"];
  // A weak test result moves exercise up. (With TUG phases, the weakest phase
  // will pick strength vs. balance wording here.)
  if (f.chairBelow || f.tugAtRisk || f.balanceAtRisk) order.push("exercise", "meds", "home");
  else order.push("meds", "exercise", "home");
  return order;
}

interface StepText { title: string; body: string }

export const STEP_TEXT: Record<Lang, Record<StepKey, StepText>> = {
  en: {
    doctor: {
      title: "Talk to the doctor about falls",
      body: "Bring the one-page clinician summary to the next visit and ask for a fall risk check. If there was an injury from a fall, call the doctor soon.",
    },
    exercise: {
      title: "Do exercises for leg strength and balance",
      body: "Ask the doctor about a program such as tai chi or physical therapy. Stronger legs and better balance lower the chance of falling.",
    },
    meds: {
      title: "Have all medicines reviewed",
      body: "Some medicines can cause dizziness or sleepiness. Bring every pill, vitamin and supplement to the doctor or pharmacist for a review. Do not stop any medicine on your own.",
    },
    home: {
      title: "Make the home safer",
      body: "Remove trip hazards like loose rugs and clutter. Add grab bars in the bathroom and rails on both sides of stairs. Keep rooms and hallways well lit, especially at night.",
    },
    repeat: {
      title: "Check again in a year",
      body: "Repeat this screening once a year, or sooner if walking or balance changes, and share the results at your yearly checkup.",
    },
  },
  es: {
    doctor: {
      title: "Hable con el médico sobre las caídas",
      body: "Lleve el resumen de una página a la próxima cita y pida una evaluación del riesgo de caídas. Si hubo una lesión por una caída, llame pronto al médico.",
    },
    exercise: {
      title: "Haga ejercicios de fuerza y equilibrio",
      body: "Pregunte al médico por un programa como tai chi o terapia física. Piernas más fuertes y mejor equilibrio bajan el riesgo de caerse.",
    },
    meds: {
      title: "Pida una revisión de todos sus medicamentos",
      body: "Algunos medicamentos pueden causar mareo o sueño. Lleve todas sus pastillas, vitaminas y suplementos al médico o farmacéutico. No deje ningún medicamento por su cuenta.",
    },
    home: {
      title: "Haga la casa más segura",
      body: "Quite lo que pueda causar tropiezos, como tapetes sueltos y objetos en el piso. Ponga barras de apoyo en el baño y pasamanos a ambos lados de las escaleras. Mantenga buena luz, sobre todo de noche.",
    },
    repeat: {
      title: "Repita la prueba en un año",
      body: "Haga esta evaluación una vez al año, o antes si cambia su forma de caminar o su equilibrio, y comparta los resultados en su chequeo anual.",
    },
  },
};

/* ---------- Personalization (Nov 14) ----------
 * The same five STEADI steps for everyone read as a generic handout. Each step
 * now adds one or two sentences tied to THIS person's answers and measured
 * results, and the exercise step names strength or balance from what was weak.
 * Plain inputs (strings already formatted the way the results screen shows
 * them) so both the on-device plan and the AI writer's facts can use it.
 */

export type WalkingAidKind = "none" | "cane" | "walker" | "other";

export interface PlanContext {
  screening: { unsteady: boolean; worry: boolean; fallen: boolean; fallCount: "1" | "2" | "3+" | null; injured: boolean | null };
  walkingAid: WalkingAidKind | null;
  /** Measured TUG total ("9.8"), or null. */
  tugSec: string | null;
  tugAtRisk: boolean | null;
  chairScore: string | null;
  chairNorm: string | null;
  chairBelow: boolean | null;
  armsUsed: boolean | null;
  /** null = balance not done. failedStage = the position they could not hold (or null if all held). */
  balance: { tandemHeld10: boolean; failedStage: number | null; failedHeldSec: string | null } | null;
}

/** What the plan should focus on, from the person's own results (also sent to the AI writer). */
export type Focus =
  | "leg_strength"
  | "balance"
  | "walking_speed"
  | "fear_of_falling"
  | "injured_in_fall"
  | "repeated_falls"
  | "feels_unsteady"
  | "uses_cane"
  | "uses_walker"
  | "keep_it_up";

export function focusAreas(c: PlanContext): Focus[] {
  const f: Focus[] = [];
  if (c.armsUsed || c.chairBelow) f.push("leg_strength");
  if (c.balance && !c.balance.tandemHeld10) f.push("balance");
  if (c.tugAtRisk) f.push("walking_speed");
  if (c.screening.worry) f.push("fear_of_falling");
  if (c.screening.injured) f.push("injured_in_fall");
  if (c.screening.fallCount === "2" || c.screening.fallCount === "3+") f.push("repeated_falls");
  if (c.screening.unsteady) f.push("feels_unsteady");
  if (c.walkingAid === "cane") f.push("uses_cane");
  if (c.walkingAid === "walker") f.push("uses_walker");
  if (!f.some((x) => x === "leg_strength" || x === "balance" || x === "walking_speed")) f.push("keep_it_up");
  return f;
}

const fallsText = { en: { "2": "2 times", "3+": "3 or more times" }, es: { "2": "2 veces", "3+": "3 o más veces" } } as const;

/** Title for the exercise step: strength, balance, or both, from what was weak. */
export function exerciseTitle(c: PlanContext, lang: Lang): string {
  const legs = !!(c.armsUsed || c.chairBelow);
  const bal = !!((c.balance && !c.balance.tandemHeld10) || c.tugAtRisk);
  if (legs && !bal) return lang === "es" ? "Haga ejercicios para fortalecer las piernas" : "Build leg strength";
  if (bal && !legs) return lang === "es" ? "Practique ejercicios de equilibrio" : "Practice balance exercises";
  if (!legs && !bal) return lang === "es" ? "Manténgase activo" : "Stay active";
  return STEP_TEXT[lang].exercise.title;
}

/** One or two sentences that connect a step to this person's results (null = nothing specific). */
export function stepDetail(key: StepKey, c: PlanContext, lang: Lang): string | null {
  const es = lang === "es";
  const s = c.screening;
  const out: string[] = [];
  const multi = s.fallCount === "2" || s.fallCount === "3+" ? fallsText[lang][s.fallCount] : null;
  switch (key) {
    case "doctor":
      if (s.injured) out.push(es ? "Cuéntele sobre la caída en la que se lastimó." : "Tell them about the fall where you were hurt.");
      else if (multi) out.push(es ? `Dígale que se cayó ${multi} en el último año.` : `Tell them you fell ${multi} in the past year.`);
      if (s.worry) out.push(es ? "Dígale también que le preocupa caerse; vale la pena hablarlo." : "Also tell them you worry about falling. That worry is worth talking about.");
      else if (s.unsteady) out.push(es ? "Dígale que se siente inestable al estar de pie o caminar." : "Tell them you feel unsteady when standing or walking.");
      if (!out.length && c.tugAtRisk && c.tugSec)
        out.push(es ? `Muéstrele su tiempo de Levántate y Anda: ${c.tugSec} segundos.` : `Show them your Timed Up and Go time: ${c.tugSec} seconds.`);
      break;
    case "exercise":
      if (c.armsUsed)
        out.push(es ? "Necesitó los brazos para levantarse de la silla, así que fortalecer las piernas es lo que más ayuda." : "You needed your arms to stand up from the chair, so leg-strength exercises will help most.");
      else if (c.chairBelow && c.chairScore && c.chairNorm)
        out.push(
          es
            ? `Se levantó ${c.chairScore} veces; para su edad, menos de ${c.chairNorm} está por debajo del promedio. Fortalecer las piernas ayuda con esto.`
            : `You stood up ${c.chairScore} times; for your age, fewer than ${c.chairNorm} is below average. Leg-strength exercises help with this.`,
        );
      if (c.balance && !c.balance.tandemHeld10 && c.balance.failedStage && c.balance.failedHeldSec)
        out.push(
          es
            ? `Mantuvo la posición ${c.balance.failedStage} durante ${c.balance.failedHeldSec} segundos. Los ejercicios de equilibrio practican justo esto; pregunte cuáles son seguros para usted.`
            : `You held position ${c.balance.failedStage} for ${c.balance.failedHeldSec} seconds. Balance exercises practice exactly this; ask which ones are safe for you.`,
        );
      if (c.tugAtRisk && c.tugSec && out.length < 2)
        out.push(
          es
            ? `Su prueba de caminar tomó ${c.tugSec} segundos (12 o más indica más riesgo). Practicar caminar y el equilibrio puede ayudar.`
            : `Your walking test took ${c.tugSec} seconds (12 or more means higher risk). Walking and balance practice can help.`,
        );
      if (!out.length) out.push(es ? "Hoy le fue bien. Mantenerse activo ayuda a que siga así." : "Your results were good today. Staying active helps keep them that way.");
      break;
    case "meds":
      if (s.unsteady) out.push(es ? "Dijo que se siente inestable; algunos medicamentos pueden influir, así que esta revisión es importante para usted." : "You said you feel unsteady. Some medicines can add to that, so this review matters for you.");
      else if (s.fallen) out.push(es ? "Después de una caída, revisar los medicamentos es de lo primero que conviene hacer." : "After a fall, a medicine review is one of the first things to check.");
      break;
    case "home":
      if (s.fallen) out.push(es ? "Empiece por el lugar donde se cayó y arregle lo que lo causó, si puede." : "Start with the place where you fell, and fix what caused it if you can.");
      if (c.walkingAid === "walker") out.push(es ? "Con andador, mantenga los pasillos anchos y despejados, y quite los tapetes pequeños." : "With a walker, keep paths wide and clear, and remove small rugs.");
      else if (c.walkingAid === "cane") out.push(es ? "Con bastón, asegúrese de que las escaleras tengan pasamanos a ambos lados." : "With a cane, make sure stairs have a rail on both sides.");
      if (!out.length && s.worry) out.push(es ? "Una casa más segura también ayuda a moverse con más confianza." : "A safer home can also help you feel more confident moving around.");
      break;
    case "repeat":
      if (c.tugSec) {
        const chair = c.chairScore ? (es ? `, levantarse de la silla ${c.chairScore}` : `, chair stand ${c.chairScore}`) : "";
        out.push(
          es
            ? `Anote los resultados de hoy (Levántate y Anda ${c.tugSec} segundos${chair}) para comparar el próximo año.`
            : `Write down today's results (Timed Up and Go ${c.tugSec} seconds${chair}) to compare next year.`,
        );
      }
      break;
  }
  return out.length ? out.slice(0, 2).join(" ") : null;
}

/** PlanContext from the session on the phone (numbers formatted like the results screen). */
export function planContext(s: SessionState): PlanContext {
  const tug = tugMeasured(s.tug);
  const chair = chairMeasured(s.chair);
  const sc = chair ? scoreChairStand(chair.stands, chair.armUse, s.profile.age, s.profile.sex) : null;
  const bal = s.balance && !isSkipped(s.balance) ? s.balance : null;
  const failed = bal ? bal.stages.find((x) => !x.completed) ?? null : null;
  return {
    screening: s.screening,
    walkingAid: s.profile.walkingAid ?? null,
    tugSec: tug ? tug.totalSec.toFixed(1) : null,
    tugAtRisk: tug ? tugAtRisk(tug.totalSec) : null,
    chairScore: sc ? String(sc.score) : null,
    chairNorm: sc && sc.norm !== null ? String(sc.norm) : null,
    chairBelow: sc ? sc.belowAverage : null,
    armsUsed: chair ? chair.armUse : null,
    balance: bal
      ? { tandemHeld10: bal.tandemHeld10, failedStage: failed ? failed.stage : null, failedHeldSec: failed ? failed.heldS.toFixed(1) : null }
      : null,
  };
}
