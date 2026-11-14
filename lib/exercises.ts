/**
 * Exercises shown under the family plan (Nov 14). Chosen from this person's own
 * results, but the exercise text is fixed and written here, never by the AI
 * writer: a model must not invent an exercise routine for someone who just
 * showed a balance or leg-strength problem.
 *
 * - Chair rise: steps, repetitions and the "start with fewer" advice are the
 *   CDC STEADI "Chair Rise Exercise" brochure (2017), worded for the screen.
 * - Balance practice: the four stances are the ones in the CDC 4-Stage Balance
 *   Test; the support (a counter, a chair behind, a helper) and the short holds
 *   are the app's own safety wording, not a CDC exercise.
 */
import type { Lang } from "./i18n";
import type { PlanContext } from "./report";

export type ExerciseId = "chair_rise" | "balance_1" | "balance_2" | "balance_3" | "balance_4";

export interface ExerciseCard {
  id: ExerciseId;
  title: string;
  /** Why this one, tied to the person's results. */
  why: string;
  steps: string[];
  /** How many, how long. */
  dose: string;
  /** Easier start, when there is one. */
  easier?: string;
}

export interface ExercisePlan {
  cards: ExerciseCard[];
  /** Safety lines: first the general ones, then the ask-the-doctor line when risk is higher. */
  safety: string[];
}

const TEXT = {
  en: {
    chair: {
      title: "Chair rise",
      steps: [
        "Sit toward the front of a sturdy chair, with your knees bent and feet flat on the floor, shoulder-width apart. Put the chair against a wall so it can't slide.",
        "Rest your hands lightly on the seat on either side of you. Keep your back and neck straight, and your chest slightly forward.",
        "Breathe in slowly. Lean forward and feel your weight on the front of your feet.",
        "Breathe out, and slowly stand up, using your hands as little as possible.",
        "Pause for a full breath in and out.",
        "Breathe in as you slowly sit down. Don't collapse back into the chair; control your lowering as much as you can.",
        "Breathe out.",
      ],
      dose: "Repeat 10 to 15 times. Rest for a minute, then do one more set of 10 to 15.",
      easier: "If that is too hard at first, start with fewer and work up. The goal is to do it without using your hands.",
      whyArms: "You used your arms to stand up in the chair test. This builds the thigh and buttock muscles you need to stand without them.",
      whyBelow: (n: string, norm: string) =>
        `You stood up ${n} times in 30 seconds. For your age, fewer than ${norm} is below average. This builds the muscles you use to stand.`,
      whyTug: (sec: string) => `Your walking test took ${sec} seconds. Stronger legs help with getting up and walking.`,
      whyGood: "Your results were good today. This keeps your legs strong.",
    },
    bal: {
      common: [
        "Stand next to a kitchen counter or sturdy table, and hold it with both hands. Keep a sturdy chair right behind you.",
        "Have someone stand close by the first few times.",
      ],
      titles: {
        1: "Balance practice: feet together",
        2: "Balance practice: instep to big toe",
        3: "Balance practice: heel to toe",
        4: "Balance practice: one foot",
      },
      stance: {
        1: "Put your feet side by side, touching.",
        2: "Slide one foot forward, so the middle of that foot (the instep) touches the big toe of the other foot.",
        3: "Put one foot right in front of the other, heel touching toe, like standing on a line.",
        4: "Shift your weight onto one foot. Lift the other foot a little off the floor.",
      },
      hold: "Look at one spot straight ahead. Hold for up to 10 seconds, then rest.",
      progress: "When it feels steady, hold with just one hand, then with one fingertip. Never let go completely unless someone is beside you.",
      dose: (n: number) =>
        n === 4 ? "Do it 3 times, then switch feet. Practice on most days of the week." : "Do it 3 times, then switch which foot is in front. Practice on most days of the week.",
      easier: "If you can't hold it for 10 seconds, hold for as long as you can and build up slowly.",
      why: (stage: number, sec: string) =>
        `You held position ${stage} for ${sec} seconds in the balance test. Practicing this exact position, with support, is how to work on it.`,
      whyTug: (sec: string) => `Your walking test took ${sec} seconds. Practicing a narrow stance, with support, trains the balance you need to walk.`,
    },
    safety: {
      general: [
        "Do these only on a day you feel well.",
        "Stop if you feel dizzy, have pain, or feel short of breath, and tell your doctor.",
      ],
      aid: "Keep your walker or cane within reach.",
      doctor: "Your results suggest a higher risk of falling. Ask your doctor or a physical therapist to check these exercises before you start.",
    },
  },
  es: {
    chair: {
      title: "Levantarse de la silla",
      steps: [
        "Siéntese en la parte delantera de una silla firme, con las rodillas dobladas y los pies planos en el piso, separados a la anchura de los hombros. Ponga la silla contra una pared para que no se deslice.",
        "Apoye las manos suavemente en el asiento, a cada lado. Mantenga la espalda y el cuello rectos, y el pecho un poco hacia adelante.",
        "Inhale despacio. Inclínese hacia adelante y sienta el peso en la parte delantera de los pies.",
        "Exhale y levántese despacio, usando las manos lo menos posible.",
        "Haga una pausa para inhalar y exhalar por completo.",
        "Inhale mientras se sienta despacio. No se deje caer en la silla; controle el descenso lo más que pueda.",
        "Exhale.",
      ],
      dose: "Repita de 10 a 15 veces. Descanse un minuto y haga otra serie de 10 a 15.",
      easier: "Si al principio es demasiado difícil, empiece con menos y vaya subiendo. La meta es hacerlo sin usar las manos.",
      whyArms: "Usó los brazos para levantarse en la prueba de la silla. Este ejercicio fortalece los muslos y los glúteos que necesita para levantarse sin ellos.",
      whyBelow: (n: string, norm: string) =>
        `Se levantó ${n} veces en 30 segundos. Para su edad, menos de ${norm} está por debajo del promedio. Este ejercicio fortalece los músculos que usa para levantarse.`,
      whyTug: (sec: string) => `Su prueba de caminar tomó ${sec} segundos. Piernas más fuertes ayudan a levantarse y a caminar.`,
      whyGood: "Hoy le fue bien. Este ejercicio mantiene fuertes sus piernas.",
    },
    bal: {
      common: [
        "Párese junto a un mostrador de cocina o una mesa firme y agárrese con las dos manos. Tenga una silla firme justo detrás de usted.",
        "Pida que alguien se quede cerca las primeras veces.",
      ],
      titles: {
        1: "Práctica de equilibrio: pies juntos",
        2: "Práctica de equilibrio: empeine al dedo gordo",
        3: "Práctica de equilibrio: talón con punta",
        4: "Práctica de equilibrio: un pie",
      },
      stance: {
        1: "Ponga los pies lado a lado, tocándose.",
        2: "Deslice un pie hacia adelante, de modo que la parte media de ese pie (el empeine) toque el dedo gordo del otro pie.",
        3: "Ponga un pie justo delante del otro, con el talón tocando la punta, como si estuviera parado sobre una línea.",
        4: "Pase el peso a un pie. Levante un poco el otro pie del piso.",
      },
      hold: "Mire un punto al frente. Aguante hasta 10 segundos y descanse.",
      progress: "Cuando se sienta firme, agárrese con una sola mano y luego con la punta de un dedo. No se suelte por completo a menos que alguien esté a su lado.",
      dose: (n: number) =>
        n === 4 ? "Hágalo 3 veces y cambie de pie. Practique casi todos los días de la semana." : "Hágalo 3 veces y cambie el pie que va adelante. Practique casi todos los días de la semana.",
      easier: "Si no puede aguantar 10 segundos, aguante lo que pueda y suba poco a poco.",
      why: (stage: number, sec: string) =>
        `Mantuvo la posición ${stage} durante ${sec} segundos en la prueba de equilibrio. Practicar justo esta posición, con apoyo, es la forma de mejorarla.`,
      whyTug: (sec: string) => `Su prueba de caminar tomó ${sec} segundos. Practicar una postura angosta, con apoyo, entrena el equilibrio que necesita para caminar.`,
    },
    safety: {
      general: [
        "Hágalos solo un día en que se sienta bien.",
        "Pare si siente mareo, dolor o falta de aire, y avise a su médico.",
      ],
      aid: "Tenga a mano su andador o bastón.",
      doctor: "Sus resultados sugieren un riesgo mayor de caídas. Pida a su médico o a un fisioterapeuta que revise estos ejercicios antes de empezar.",
    },
  },
} as const;

function higherRisk(c: PlanContext): boolean {
  const s = c.screening;
  return !!(s.unsteady || s.worry || s.fallen || c.tugAtRisk || c.chairBelow || (c.balance && !c.balance.tandemHeld10));
}

/** The exercises for this person: leg strength and/or the balance position they could not hold. */
export function exercisesFor(c: PlanContext, lang: Lang): ExercisePlan {
  const T = TEXT[lang];
  const cards: ExerciseCard[] = [];

  const legsWeak = !!(c.armsUsed || c.chairBelow);
  const balFail = c.balance && !c.balance.tandemHeld10 && c.balance.failedStage ? c.balance : null;

  // Leg strength, or keeping it up when nothing was weak (and the TUG is the only concern).
  if (legsWeak || !balFail || c.tugAtRisk) {
    const why = c.armsUsed
      ? T.chair.whyArms
      : c.chairBelow && c.chairScore && c.chairNorm
        ? T.chair.whyBelow(c.chairScore, c.chairNorm)
        : c.tugAtRisk && c.tugSec
          ? T.chair.whyTug(c.tugSec)
          : T.chair.whyGood;
    cards.push({ id: "chair_rise", title: T.chair.title, why, steps: [...T.chair.steps], dose: T.chair.dose, easier: T.chair.easier });
  }

  // Balance: practice the exact stance they could not hold; a slow walk with no balance result gets the heel-to-toe one.
  const stage = balFail ? balFail.failedStage! : c.tugAtRisk && !legsWeak ? 3 : null;
  if (stage && cards.length < 2) {
    const n = Math.min(4, Math.max(1, stage)) as 1 | 2 | 3 | 4;
    const why = balFail && balFail.failedHeldSec ? T.bal.why(n, balFail.failedHeldSec) : T.bal.whyTug(c.tugSec ?? "");
    cards.push({
      id: `balance_${n}` as ExerciseId,
      title: T.bal.titles[n],
      why,
      steps: [...T.bal.common, T.bal.stance[n], T.bal.hold, T.bal.progress],
      dose: T.bal.dose(n),
      easier: T.bal.easier,
    });
  }

  const safety: string[] = [...T.safety.general];
  if (c.walkingAid === "cane" || c.walkingAid === "walker") safety.push(T.safety.aid);
  if (higherRisk(c)) safety.push(T.safety.doctor);
  return { cards, safety };
}
