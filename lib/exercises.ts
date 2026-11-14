/**
 * The exercise library (Nov 14). The AI plan writer picks 3-4 of these for each
 * person and writes them up for that person; the checker (lib/reportgen/check.ts)
 * only accepts exercises from this library, with numbers taken from it. If the
 * writer is off or fails the checks, the app shows the library text itself.
 *
 * - chair_rise: steps, repetitions and "start with fewer" are the CDC STEADI
 *   "Chair Rise Exercise" brochure (2017), worded for the screen.
 * - balance_1..4: the four stances of the CDC 4-Stage Balance Test, as practice.
 * - The others are common strength, balance and walking exercises for older
 *   adults, written conservatively (always with a counter, a chair or a helper).
 *   They are not CDC text: a doctor or physical therapist should review them.
 */
import type { Lang } from "./i18n";
import type { PlanContext } from "./report";

export const EXERCISE_IDS = [
  "chair_rise",
  "seated_march",
  "heel_raises",
  "side_leg_raise",
  "back_leg_raise",
  "weight_shift",
  "balance_1",
  "balance_2",
  "balance_3",
  "balance_4",
  "tandem_walk_counter",
  "daily_walk",
] as const;
export type ExerciseId = (typeof EXERCISE_IDS)[number];

export interface ExerciseCard {
  id: ExerciseId;
  title: string;
  /** Why this one, tied to the person's results. */
  why: string;
  steps: string[];
  /** How many, how long. */
  dose: string;
  /** Easier start ("" when there is none). */
  easier: string;
  /** A tip for this person's situation (walking aid, side, support); "" when there is none. */
  tip: string;
}

export interface ExercisePlan {
  cards: ExerciseCard[];
  /** Safety lines: the general ones, then the ask-the-doctor line when risk is higher. */
  safety: string[];
}

interface Entry {
  title: string;
  steps: string[];
  dose: string;
  easier: string;
}

const COUNTER_EN = "Stand next to a kitchen counter or sturdy table, and hold it with both hands. Keep a sturdy chair right behind you.";
const COUNTER_ES = "Párese junto a un mostrador de cocina o una mesa firme y agárrese con ambas manos. Tenga una silla firme justo detrás de usted.";
const HELPER_EN = "Have someone stand close by the first few times.";
const HELPER_ES = "Pida que alguien se quede cerca las primeras veces.";

const STANCE_EN = {
  1: "Put your feet side by side, touching.",
  2: "Slide one foot forward, so the middle of that foot (the instep) touches the big toe of the other foot.",
  3: "Put one foot right in front of the other, heel touching toe, like standing on a line.",
  4: "Shift your weight onto one foot. Lift the other foot a little off the floor.",
} as const;
const STANCE_ES = {
  1: "Ponga los pies lado a lado, tocándose.",
  2: "Deslice un pie hacia adelante, de modo que la parte media de ese pie (el empeine) toque el dedo gordo del otro pie.",
  3: "Ponga un pie justo delante del otro, con el talón tocando la punta, como si estuviera parado sobre una línea.",
  4: "Pase el peso a un pie. Levante un poco el otro pie del piso.",
} as const;
const STANCE_TITLE_EN = {
  1: "Balance practice: feet together",
  2: "Balance practice: instep to big toe",
  3: "Balance practice: heel to toe",
  4: "Balance practice: one foot",
} as const;
const STANCE_TITLE_ES = {
  1: "Práctica de equilibrio: pies juntos",
  2: "Práctica de equilibrio: empeine al dedo gordo",
  3: "Práctica de equilibrio: talón con punta",
  4: "Práctica de equilibrio: un pie",
} as const;

function balanceEn(n: 1 | 2 | 3 | 4): Entry {
  return {
    title: STANCE_TITLE_EN[n],
    steps: [
      COUNTER_EN,
      HELPER_EN,
      STANCE_EN[n],
      "Look at one spot straight ahead. Hold for up to 10 seconds, then rest.",
      "When it feels steady, hold with just one hand, then with one fingertip. Never let go completely unless someone is beside you.",
    ],
    dose: n === 4 ? "Do it 3 times, then switch feet. Practice on most days of the week." : "Do it 3 times, then switch which foot is in front. Practice on most days of the week.",
    easier: "If you can't hold it for 10 seconds, hold for as long as you can and build up slowly.",
  };
}
function balanceEs(n: 1 | 2 | 3 | 4): Entry {
  return {
    title: STANCE_TITLE_ES[n],
    steps: [
      COUNTER_ES,
      HELPER_ES,
      STANCE_ES[n],
      "Mire un punto al frente. Aguante hasta 10 segundos y descanse.",
      "Cuando se sienta firme, agárrese con una sola mano y luego con la punta de un dedo. No se suelte por completo a menos que alguien esté a su lado.",
    ],
    dose: n === 4 ? "Hágalo 3 veces y cambie de pie. Practique casi todos los días de la semana." : "Hágalo 3 veces y cambie el pie que va adelante. Practique casi todos los días de la semana.",
    easier: "Si no puede aguantar 10 segundos, aguante lo que pueda y suba poco a poco.",
  };
}

export const LIBRARY: Record<Lang, Record<ExerciseId, Entry>> = {
  en: {
    chair_rise: {
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
    },
    seated_march: {
      title: "Seated march",
      steps: [
        "Sit tall near the front of a sturdy chair, with your feet flat on the floor. Put the chair against a wall so it can't slide.",
        "Hold the sides of the seat for support.",
        "Lift one knee up, as high as is comfortable, then lower that foot slowly to the floor.",
        "Lift the other knee the same way. Keep breathing as you go.",
      ],
      dose: "Lift each leg 10 times. Rest for a minute, then do it 1 more time.",
      easier: "If 10 is too many, start with 5 on each leg.",
    },
    heel_raises: {
      title: "Heel raises",
      steps: [
        COUNTER_EN,
        "Stand tall, with your feet about shoulder-width apart.",
        "Slowly rise up onto your toes, as high as is comfortable.",
        "Pause for a breath, then slowly lower your heels to the floor.",
      ],
      dose: "Repeat 10 times. Rest for a minute, then do 1 more set of 10.",
      easier: "If that is hard, start with 5.",
    },
    side_leg_raise: {
      title: "Side leg raise",
      steps: [
        COUNTER_EN,
        "Stand tall, with your feet together and your toes pointing forward.",
        "Slowly lift one leg out to the side. Keep your back straight and don't lean.",
        "Pause, then slowly lower it to the floor.",
      ],
      dose: "Repeat 10 times on each leg. Rest for a minute between legs.",
      easier: "If that is hard, start with 5 on each leg.",
    },
    back_leg_raise: {
      title: "Back leg raise",
      steps: [
        COUNTER_EN,
        "Stand tall, with your feet together.",
        "Slowly lift one leg straight back, without bending your knee or leaning forward.",
        "Pause, then slowly lower it to the floor.",
      ],
      dose: "Repeat 10 times on each leg. Rest for a minute between legs.",
      easier: "If that is hard, start with 5 on each leg.",
    },
    weight_shift: {
      title: "Side-to-side weight shift",
      steps: [
        COUNTER_EN,
        HELPER_EN,
        "Stand with your feet shoulder-width apart and your back straight.",
        "Slowly shift your weight onto your right foot, keeping both feet on the floor. Hold for a breath.",
        "Slowly shift your weight onto your left foot. Hold for a breath.",
      ],
      dose: "Shift from side to side 10 times. Rest for a minute, then do 1 more set.",
      easier: "If that is hard, start with 5.",
    },
    balance_1: balanceEn(1),
    balance_2: balanceEn(2),
    balance_3: balanceEn(3),
    balance_4: balanceEn(4),
    tandem_walk_counter: {
      title: "Heel-to-toe walk along the counter",
      steps: [
        "Stand beside a kitchen counter, with one hand resting on it. Keep a sturdy chair at the far end.",
        HELPER_EN,
        "Step forward, putting the heel of one foot right in front of the toes of the other, like walking on a line.",
        "Look ahead, not down at your feet.",
        "Take up to 10 steps along the counter, then turn carefully and come back.",
      ],
      dose: "Do it 2 times. Practice on most days of the week.",
      easier: "If that is hard, take fewer steps and keep a hand on the counter the whole time.",
    },
    daily_walk: {
      title: "Daily walk with a helper",
      steps: [
        "Pick a flat, clear, well-lit path, inside or outside.",
        "Wear sturdy shoes with flat, non-slip soles.",
        "Walk at a comfortable pace with someone beside you. Use your cane or walker if you have one.",
        "Stand tall and look ahead, not down at your feet.",
      ],
      dose: "Walk a little every day. Start short and add a little at a time.",
      easier: "If you get tired or short of breath, stop and rest.",
    },
  },
  es: {
    chair_rise: {
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
    },
    seated_march: {
      title: "Marcha sentado",
      steps: [
        "Siéntese derecho en la parte delantera de una silla firme, con los pies planos en el piso. Ponga la silla contra una pared para que no se deslice.",
        "Agárrese de los lados del asiento para apoyarse.",
        "Levante una rodilla lo más alto que le resulte cómodo y baje ese pie despacio al piso.",
        "Levante la otra rodilla de la misma manera. Siga respirando.",
      ],
      dose: "Levante cada pierna 10 veces. Descanse un minuto y repita 1 vez más.",
      easier: "Si 10 son demasiadas, empiece con 5 en cada pierna.",
    },
    heel_raises: {
      title: "Subir en puntas de pie",
      steps: [
        COUNTER_ES,
        "Párese derecho, con los pies separados a la anchura de los hombros.",
        "Suba despacio en puntas de pie, lo más alto que le resulte cómodo.",
        "Haga una pausa para respirar y baje los talones despacio al piso.",
      ],
      dose: "Repita 10 veces. Descanse un minuto y haga 1 serie más de 10.",
      easier: "Si le resulta difícil, empiece con 5.",
    },
    side_leg_raise: {
      title: "Levantar la pierna hacia el lado",
      steps: [
        COUNTER_ES,
        "Párese derecho, con los pies juntos y las puntas hacia adelante.",
        "Levante despacio una pierna hacia el lado. Mantenga la espalda recta y no se incline.",
        "Haga una pausa y bájela despacio al piso.",
      ],
      dose: "Repita 10 veces con cada pierna. Descanse un minuto entre una pierna y otra.",
      easier: "Si le resulta difícil, empiece con 5 en cada pierna.",
    },
    back_leg_raise: {
      title: "Levantar la pierna hacia atrás",
      steps: [
        COUNTER_ES,
        "Párese derecho, con los pies juntos.",
        "Levante despacio una pierna hacia atrás, sin doblar la rodilla ni inclinarse hacia adelante.",
        "Haga una pausa y bájela despacio al piso.",
      ],
      dose: "Repita 10 veces con cada pierna. Descanse un minuto entre una pierna y otra.",
      easier: "Si le resulta difícil, empiece con 5 en cada pierna.",
    },
    weight_shift: {
      title: "Pasar el peso de un lado al otro",
      steps: [
        COUNTER_ES,
        HELPER_ES,
        "Párese con los pies separados a la anchura de los hombros y la espalda recta.",
        "Pase el peso despacio al pie derecho, con ambos pies en el piso. Aguante una respiración.",
        "Pase el peso despacio al pie izquierdo. Aguante una respiración.",
      ],
      dose: "Pase el peso de lado a lado 10 veces. Descanse un minuto y haga 1 serie más.",
      easier: "Si le resulta difícil, empiece con 5.",
    },
    balance_1: balanceEs(1),
    balance_2: balanceEs(2),
    balance_3: balanceEs(3),
    balance_4: balanceEs(4),
    tandem_walk_counter: {
      title: "Caminar talón con punta junto al mostrador",
      steps: [
        "Párese junto a un mostrador de cocina, con una mano apoyada en él. Tenga una silla firme en el otro extremo.",
        HELPER_ES,
        "Dé un paso adelante poniendo el talón de un pie justo delante de la punta del otro, como si caminara sobre una línea.",
        "Mire al frente, no a los pies.",
        "Dé hasta 10 pasos a lo largo del mostrador, gire con cuidado y regrese.",
      ],
      dose: "Hágalo 2 veces. Practique casi todos los días de la semana.",
      easier: "Si le resulta difícil, dé menos pasos y mantenga una mano en el mostrador todo el tiempo.",
    },
    daily_walk: {
      title: "Caminata diaria con ayuda",
      steps: [
        "Escoja un camino plano, despejado y bien iluminado, dentro o fuera de casa.",
        "Use zapatos firmes con suela plana y antideslizante.",
        "Camine a un paso cómodo con alguien a su lado. Use su bastón o andador si lo tiene.",
        "Manténgase derecho y mire al frente, no a los pies.",
      ],
      dose: "Camine un poco todos los días. Empiece con poco y aumente de a poco.",
      easier: "Si se cansa o le falta el aire, pare y descanse.",
    },
  },
};

const SAFETY = {
  en: {
    general: [
      "Do these only on a day you feel well.",
      "Stop if you feel dizzy, have pain, or feel short of breath, and tell your doctor.",
    ],
    aid: "Keep your walker or cane within reach.",
    doctor: "Your results suggest a higher risk of falling. Ask your doctor or a physical therapist to check these exercises before you start.",
  },
  es: {
    general: [
      "Hágalos solo un día en que se sienta bien.",
      "Pare si siente mareo, dolor o falta de aire, y avise a su médico.",
    ],
    aid: "Tenga a mano su andador o bastón.",
    doctor: "Sus resultados sugieren un riesgo mayor de caídas. Pida a su médico o a un fisioterapeuta que revise estos ejercicios antes de empezar.",
  },
} as const;

const WHY = {
  en: {
    legArms: "You used your arms to stand up in the chair test, so building leg strength helps most.",
    legBelow: (n: string, norm: string) => `You stood up ${n} times in 30 seconds. For your age, fewer than ${norm} is below average. This builds the muscles you use to stand.`,
    legTug: (sec: string) => `Your walking test took ${sec} seconds. Stronger legs help with getting up and walking.`,
    legGood: "Your results were good today. This keeps your legs strong.",
    bal: (stage: number, sec: string) => `You held position ${stage} for ${sec} seconds in the balance test. Practicing this exact position, with support, is how to work on it.`,
    balEasier: "A little easier than the position you could not hold, so you can build up to it.",
    balGood: "You held the heel-to-toe position for 10 seconds. This keeps your balance sharp.",
    balTug: (sec: string) => `Your walking test took ${sec} seconds. Balance practice, with support, helps with walking.`,
    walk: "Regular walking with someone beside you keeps you moving and builds confidence.",
    general: "A gentle exercise that helps with strength and balance.",
  },
  es: {
    legArms: "Usó los brazos para levantarse en la prueba de la silla, así que fortalecer las piernas es lo que más ayuda.",
    legBelow: (n: string, norm: string) => `Se levantó ${n} veces en 30 segundos. Para su edad, menos de ${norm} está por debajo del promedio. Este ejercicio fortalece los músculos que usa para levantarse.`,
    legTug: (sec: string) => `Su prueba de caminar tomó ${sec} segundos. Piernas más fuertes ayudan a levantarse y a caminar.`,
    legGood: "Hoy le fue bien. Este ejercicio mantiene fuertes sus piernas.",
    bal: (stage: number, sec: string) => `Mantuvo la posición ${stage} durante ${sec} segundos en la prueba de equilibrio. Practicar justo esta posición, con apoyo, es la forma de mejorarla.`,
    balEasier: "Un poco más fácil que la posición que no pudo mantener, para ir subiendo hasta ella.",
    balGood: "Mantuvo la posición talón con punta durante 10 segundos. Este ejercicio conserva su equilibrio.",
    balTug: (sec: string) => `Su prueba de caminar tomó ${sec} segundos. Practicar el equilibrio, con apoyo, ayuda a caminar.`,
    walk: "Caminar con regularidad y con alguien a su lado lo mantiene activo y le da confianza.",
    general: "Un ejercicio suave que ayuda con la fuerza y el equilibrio.",
  },
} as const;

function higherRisk(c: PlanContext): boolean {
  const s = c.screening;
  return !!(s.unsteady || s.worry || s.fallen || c.tugAtRisk || c.chairBelow || (c.balance && !c.balance.tandemHeld10));
}

const failedStage = (c: PlanContext): 1 | 2 | 3 | 4 | null =>
  c.balance && !c.balance.tandemHeld10 && c.balance.failedStage ? (Math.min(4, Math.max(1, c.balance.failedStage)) as 1 | 2 | 3 | 4) : null;

/** Every exercise that is safe to offer this person. The writer may only pick from these. */
export function eligibleIds(c: PlanContext): ExerciseId[] {
  const ids: ExerciseId[] = ["chair_rise", "heel_raises", "side_leg_raise", "back_leg_raise", "weight_shift", "daily_walk"];
  if (c.armsUsed || c.chairBelow) ids.push("seated_march");
  const fs = failedStage(c);
  if (fs) {
    ids.push(`balance_${fs}` as ExerciseId);
    if (fs > 1) ids.push(`balance_${fs - 1}` as ExerciseId);
  } else if (c.balance) {
    // Held the heel-to-toe position: harder practice is fine.
    ids.push("balance_3", "balance_4", "tandem_walk_counter");
  } else {
    ids.push("balance_2");
  }
  return ids;
}

/** The app's own pick (used when the writer is off or fails): 3 or 4, in order of importance. */
export function suggestedIds(c: PlanContext): ExerciseId[] {
  const out: ExerciseId[] = [];
  const legsWeak = !!(c.armsUsed || c.chairBelow);
  const fs = failedStage(c);
  if (legsWeak) out.push(...(c.armsUsed ? (["seated_march", "chair_rise"] as const) : (["chair_rise"] as const)));
  if (fs) out.push(`balance_${fs}` as ExerciseId, "weight_shift");
  if (!legsWeak && !fs && c.tugAtRisk) out.push("chair_rise", c.balance ? "balance_3" : "balance_2");
  if (legsWeak) out.push("heel_raises");
  if (c.tugAtRisk || c.screening.unsteady) out.push("daily_walk");
  if (!legsWeak && !fs && !c.tugAtRisk) out.push("chair_rise", "heel_raises", c.balance ? "tandem_walk_counter" : "balance_2", "daily_walk");
  for (const x of ["chair_rise", "weight_shift", "heel_raises", "daily_walk"] as ExerciseId[]) out.push(x);
  const elig = new Set(eligibleIds(c));
  return [...new Set(out)].filter((x) => elig.has(x)).slice(0, 4);
}

function defaultWhy(id: ExerciseId, c: PlanContext, lang: Lang): string {
  const w = WHY[lang];
  if (id === "daily_walk") return w.walk;
  if (id === "chair_rise" || id === "seated_march" || id === "heel_raises") {
    if (c.armsUsed) return w.legArms;
    if (c.chairBelow && c.chairScore && c.chairNorm) return w.legBelow(c.chairScore, c.chairNorm);
    if (c.tugAtRisk && c.tugSec) return w.legTug(c.tugSec);
    return w.legGood;
  }
  if (id.startsWith("balance_") || id === "weight_shift" || id === "tandem_walk_counter") {
    const fs = failedStage(c);
    const n = id.startsWith("balance_") ? Number(id.slice(8)) : 0;
    if (fs && n === fs && c.balance?.failedHeldSec) return w.bal(fs, c.balance.failedHeldSec);
    if (fs && n && n < fs) return w.balEasier;
    if (c.tugAtRisk && c.tugSec) return w.balTug(c.tugSec);
    if (c.balance?.tandemHeld10 && (n >= 3 || id === "tandem_walk_counter")) return w.balGood;
  }
  return w.general;
}

/** One library exercise as a card (the library's own words). */
export function exerciseCard(id: ExerciseId, c: PlanContext, lang: Lang): ExerciseCard {
  const e = LIBRARY[lang][id];
  return { id, title: e.title, why: defaultWhy(id, c, lang), steps: [...e.steps], dose: e.dose, easier: e.easier, tip: "" };
}

/** A library exercise with the writer's why and tip (the steps and numbers stay the library's). */
export function cardFromWriter(w: { id: ExerciseId; why: string; tip: string }, lang: Lang): ExerciseCard {
  const e = LIBRARY[lang][w.id];
  return { id: w.id, title: e.title, why: w.why, steps: [...e.steps], dose: e.dose, easier: e.easier, tip: w.tip };
}

/** The exercises shown when the writer is off or fails, plus the safety lines (always app-written). */
export function exercisesFor(c: PlanContext, lang: Lang): ExercisePlan {
  return { cards: suggestedIds(c).map((id) => exerciseCard(id, c, lang)), safety: safetyLines(c, lang) };
}

export function safetyLines(c: PlanContext, lang: Lang): string[] {
  const S = SAFETY[lang];
  const out: string[] = [...S.general];
  if (c.walkingAid === "cane" || c.walkingAid === "walker") out.push(S.aid);
  if (higherRisk(c)) out.push(S.doctor);
  return out;
}

/** Numbers the writer may use in exercise text: those in the library text for these exercises. */
export function libraryNumbers(ids: readonly ExerciseId[]): Set<string> {
  const nums = new Set<string>();
  for (const lang of ["en", "es"] as const) {
    for (const id of ids) {
      const e = LIBRARY[lang][id];
      for (const m of [e.dose, e.easier, ...e.steps].join(" ").matchAll(/\d+/g)) nums.add(m[0]);
    }
  }
  return nums;
}
