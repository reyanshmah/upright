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
import { isSkipped, screenedAtRisk, type SessionState } from "./session";
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
  const tug = s.tug && !isSkipped(s.tug) ? s.tug : null;
  const chair = s.chair && !isSkipped(s.chair) ? s.chair : null;
  const sc = chair ? scoreChairStand(chair.count, chair.armsUsed, s.profile.age, s.profile.sex) : null;
  const bal = s.balance && !isSkipped(s.balance) ? s.balance : null;
  const balRisk = bal ? !bal.tandemHeld10 : null;
  const screen = screenedAtRisk(s.screening);
  const tRisk = tug ? tugAtRisk(tug.totalS) : null;
  const cBelow = sc ? sc.belowAverage : null;
  return {
    screenedAtRisk: screen,
    tugS: tug ? tug.totalS : null,
    tugAtRisk: tRisk,
    chairScore: sc ? sc.score : null,
    chairNorm: sc ? sc.norm : null,
    chairBelow: cBelow,
    armsUsed: chair ? chair.armsUsed : null,
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
