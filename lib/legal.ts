/**
 * Privacy Policy and Terms of Service for Upright Inc. (English and Spanish).
 * Written to match what the app actually does (see lib/reportgen/clientInput.ts,
 * lib/session.ts, lib/store.ts, lib/signal/privacy.ts). Have a lawyer review
 * before relying on them. Spanish is a draft for fluent review.
 *
 * The contact email comes from NEXT_PUBLIC_LEGAL_EMAIL; until it is set, the
 * pages say contact details will be posted.
 */
import type { Lang } from "./i18n";

export const LEGAL_ENTITY = "Upright Inc.";
export const LEGAL_EFFECTIVE = { en: "November 14, 2026", es: "14 de noviembre de 2026" } as const;
export const LEGAL_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "";

export interface LegalSection {
  h: string;
  p?: string[];
  list?: string[];
}
export interface LegalDoc {
  title: string;
  effective: string;
  intro: string;
  sections: LegalSection[];
}

function contact(lang: Lang): string {
  if (LEGAL_EMAIL) return lang === "es" ? `Escríbanos a ${LEGAL_EMAIL}.` : `Email us at ${LEGAL_EMAIL}.`;
  return lang === "es"
    ? "Los datos de contacto de Upright Inc. se publicarán aquí."
    : "Contact details for Upright Inc. will be posted here.";
}

export function privacyPolicy(lang: Lang): LegalDoc {
  if (lang === "es") {
    return {
      title: "Política de privacidad",
      effective: `Vigente desde el ${LEGAL_EFFECTIVE.es}`,
      intro: `${LEGAL_ENTITY} ("Upright", "nosotros") ofrece Upright, una ayuda de detección del riesgo de caídas en casa basada en el programa STEADI de los CDC. Esta política explica qué datos usa la aplicación y dónde quedan. En resumen: el video nunca sale de su teléfono y no vendemos datos.`,
      sections: [
        {
          h: "La cámara y el video",
          list: [
            "La cámara se usa solo durante las pruebas y solo en su teléfono. Un modelo en el teléfono encuentra puntos del cuerpo (como caderas, rodillas y tobillos) en cada imagen.",
            "El video no se graba, no se guarda y no se envía a ningún lugar.",
            "Los puntos de la cara se borran antes de guardar cualquier dato de la prueba.",
          ],
        },
        {
          h: "Lo que se queda en su teléfono",
          list: [
            "Sus respuestas (nombre opcional, edad, sexo, estatura, aparato para caminar y las 3 preguntas de STEADI) se guardan en esta pestaña del navegador y se borran al cerrarla.",
            "Los resultados de las pruebas se guardan en el almacenamiento del navegador en este teléfono, para que no se pierdan.",
            "Sus ajustes (idioma, tamaño de letra, colores, velocidad de la voz) se guardan en este teléfono.",
            "Puede borrar sus resultados y respuestas cuando quiera en Ajustes > Borrar mis datos.",
          ],
        },
        {
          h: "Lo que recibimos",
          p: [
            "Si está en línea en la pantalla de resultados, la aplicación pide a nuestro servidor un plan escrito. Para eso envía solo: los resultados de las pruebas (tiempos, conteos e indicadores de calidad), sus 3 respuestas de STEADI, un rango de edad, el sexo y el idioma.",
            "Nunca enviamos su nombre, su edad exacta, su estatura, video, fotos ni los puntos del cuerpo. No guardamos lo que se envía después de escribir el plan.",
          ],
        },
        {
          h: "Proveedores que nos ayudan",
          list: [
            "Nuestro proveedor de alojamiento procesa las solicitudes y puede guardar registros técnicos normales (dirección IP, hora, tipo de navegador) por seguridad.",
            "El plan escrito lo redacta el modelo de inteligencia artificial Claude, de Anthropic, a través de su API. Recibe solo los datos de la sección anterior.",
            "No usamos publicidad, análisis de uso ni cookies de seguimiento, y no vendemos ni compartimos sus datos para publicidad.",
          ],
        },
        {
          h: "Archivos que usted descarga",
          p: ["Si toca \"Descargar datos de puntos\", se guarda un archivo en su dispositivo. Ese archivo es suyo y usted decide qué hacer con él."],
        },
        {
          h: "Información de salud",
          p: ["Upright no es un proveedor de atención médica y no es un dispositivo médico. Lo que escribe se queda en su teléfono, salvo lo descrito en \"Lo que recibimos\"."],
        },
        {
          h: "Adultos",
          p: ["Upright es para adultos de 18 años o más. No recopilamos a sabiendas datos de menores."],
        },
        {
          h: "Seguridad",
          p: ["Todo el tráfico usa HTTPS. Como casi todo se queda en su teléfono, proteja el teléfono con un código o bloqueo."],
        },
        {
          h: "Sus opciones",
          p: ["Puede borrar sus datos en Ajustes en cualquier momento. Como no guardamos datos personales en nuestros servidores, normalmente no hay nada que entregar o borrar de nuestro lado; escríbanos si tiene preguntas."],
        },
        {
          h: "Cambios",
          p: ["Si cambiamos esta política, actualizaremos la fecha de arriba. Los cambios importantes se mostrarán en la aplicación."],
        },
        { h: "Contacto", p: [contact("es")] },
      ],
    };
  }
  return {
    title: "Privacy Policy",
    effective: `Effective ${LEGAL_EFFECTIVE.en}`,
    intro: `${LEGAL_ENTITY} ("Upright", "we") makes Upright, a home fall-risk screening aid based on the CDC's STEADI program. This policy explains what data the app uses and where it stays. In short: video never leaves your phone, and we don't sell data.`,
    sections: [
      {
        h: "The camera and video",
        list: [
          "The camera is used only during the tests, and only on your phone. A model on the phone finds body points (like hips, knees and ankles) in each picture.",
          "Video is never recorded, saved or sent anywhere.",
          "Face points are erased before any test data is kept.",
        ],
      },
      {
        h: "What stays on your phone",
        list: [
          "Your answers (optional first name, age, sex, height, walking aid and the 3 STEADI questions) are kept in this browser tab and cleared when you close it.",
          "Test results are saved in the browser's storage on this phone so they aren't lost.",
          "Your settings (language, text size, colors, voice speed) are saved on this phone.",
          "You can delete your results and answers any time in Settings > Delete my data.",
        ],
      },
      {
        h: "What we receive",
        p: [
          "If you are online on the results screen, the app asks our server for a written plan. To do that it sends only: the test results (times, counts and quality flags), your 3 STEADI answers, an age range, sex and language.",
          "We never send your name, exact age, height, video, photos or body points. We don't keep what is sent after the plan is written.",
        ],
      },
      {
        h: "Service providers",
        list: [
          "Our hosting provider processes requests and may keep standard technical logs (IP address, time, browser type) for security.",
          "The written plan is drafted by Anthropic's Claude AI model through its API. It receives only the data in the section above.",
          "We use no advertising, no usage analytics and no tracking cookies, and we don't sell or share your data for advertising.",
        ],
      },
      {
        h: "Files you download",
        p: ["If you tap \"Download landmark data\", a file is saved to your device. That file is yours, and you decide what to do with it."],
      },
      {
        h: "Health information",
        p: ["Upright is not a healthcare provider and is not a medical device. What you enter stays on your phone, except as described in \"What we receive\"."],
      },
      {
        h: "Adults only",
        p: ["Upright is for adults 18 and older. We do not knowingly collect data from children."],
      },
      {
        h: "Security",
        p: ["All traffic uses HTTPS. Because almost everything stays on your phone, protect the phone with a passcode or lock."],
      },
      {
        h: "Your choices",
        p: ["You can delete your data in Settings at any time. Because we keep no personal data on our servers, there is usually nothing for us to provide or delete; contact us with any questions."],
      },
      {
        h: "Changes",
        p: ["If we change this policy, we will update the date above. Important changes will be shown in the app."],
      },
      { h: "Contact", p: [contact("en")] },
    ],
  };
}

export function termsOfService(lang: Lang): LegalDoc {
  if (lang === "es") {
    return {
      title: "Términos del servicio",
      effective: `Vigentes desde el ${LEGAL_EFFECTIVE.es}`,
      intro: `Estos términos son un acuerdo entre usted y ${LEGAL_ENTITY} sobre el uso de Upright. Al usar Upright, los acepta. Si no está de acuerdo, no use la aplicación.`,
      sections: [
        {
          h: "Qué es Upright",
          p: ["Upright es una ayuda de detección en casa. Guía preguntas y pruebas del programa STEADI de los CDC y usa la cámara del teléfono para medirlas. No es un diagnóstico, no es un dispositivo médico y no reemplaza la atención de un profesional de la salud. Comparta sus resultados con su médico."],
        },
        {
          h: "Emergencias",
          p: ["Upright no sirve para emergencias. Si alguien se cae, se lastima o no se siente bien, pida ayuda médica o llame al 911 de inmediato."],
        },
        {
          h: "Seguridad durante las pruebas",
          list: [
            "Haga las pruebas solo con un ayudante justo al lado de la persona.",
            "Siga la promesa de seguridad de la aplicación: silla firme contra la pared, piso despejado y seco, y parar de inmediato si hay mareo, dolor o si la persona pide parar.",
            "No haga ninguna prueba que no sea segura para la persona. Saltar una prueba siempre está bien.",
            "Usted es responsable de decidir si las pruebas son seguras en su situación.",
          ],
        },
        {
          h: "Resultados",
          p: ["Los tiempos y conteos dependen de la cámara, la luz, la posición del teléfono y la persona. Pueden tener errores. La aplicación marca las pruebas que no pudo medir bien, pero ningún resultado es una medición clínica."],
        },
        {
          h: "Uso aceptable",
          list: [
            "Use Upright solo para usted o para alguien que le dio permiso.",
            "No intente dañar, sobrecargar ni copiar el servicio, ni usarlo para algo ilegal.",
          ],
        },
        {
          h: "Privacidad",
          p: ["Nuestra Política de privacidad explica cómo se manejan los datos. El video nunca sale de su teléfono."],
        },
        {
          h: "Propiedad",
          p: [`Upright, su diseño y su código pertenecen a ${LEGAL_ENTITY}. Las preguntas y pruebas STEADI son de los CDC; Upright no está afiliado ni respaldado por los CDC.`],
        },
        {
          h: "Sin garantías",
          p: ["Upright se ofrece \"tal cual\" y \"según disponibilidad\", sin garantías de ningún tipo, en la medida que permita la ley."],
        },
        {
          h: "Límite de responsabilidad",
          p: [`En la medida que permita la ley, ${LEGAL_ENTITY} no será responsable por daños indirectos, incidentales o consecuentes, ni por lesiones durante pruebas hechas sin seguir las instrucciones de seguridad. Nada en estos términos limita derechos que la ley no permita limitar.`],
        },
        {
          h: "Cambios y término",
          p: ["Podemos cambiar Upright o estos términos. Si los cambios son importantes, lo mostraremos en la aplicación. Puede dejar de usar Upright en cualquier momento."],
        },
        {
          h: "Ley aplicable",
          p: [`Estos términos se rigen por las leyes del estado donde ${LEGAL_ENTITY} está constituida, sin tener en cuenta sus normas de conflicto de leyes.`],
        },
        { h: "Contacto", p: [contact("es")] },
      ],
    };
  }
  return {
    title: "Terms of Service",
    effective: `Effective ${LEGAL_EFFECTIVE.en}`,
    intro: `These terms are an agreement between you and ${LEGAL_ENTITY} about using Upright. By using Upright you accept them. If you don't agree, please don't use the app.`,
    sections: [
      {
        h: "What Upright is",
        p: ["Upright is a home screening aid. It guides questions and tests from the CDC's STEADI program and uses the phone's camera to measure them. It is not a diagnosis, not a medical device, and not a substitute for care from a health professional. Share your results with your doctor."],
      },
      {
        h: "Emergencies",
        p: ["Upright is not for emergencies. If someone falls, is hurt, or feels unwell, get medical help or call 911 right away."],
      },
      {
        h: "Safety during the tests",
        list: [
          "Only do the tests with a helper standing right beside the person.",
          "Follow the app's safety promise: a sturdy chair against a wall, a clear and dry floor, and stopping right away for dizziness, pain, or if the person asks to stop.",
          "Don't do any test that isn't safe for the person. Skipping a test is always fine.",
          "You are responsible for deciding whether the tests are safe in your situation.",
        ],
      },
      {
        h: "Results",
        p: ["Times and counts depend on the camera, the light, where the phone is placed, and the person. They can be wrong. The app marks tests it couldn't measure well, but no result is a clinical measurement."],
      },
      {
        h: "Acceptable use",
        list: [
          "Use Upright only for yourself or for someone who has given you permission.",
          "Don't try to harm, overload or copy the service, or use it for anything unlawful.",
        ],
      },
      {
        h: "Privacy",
        p: ["Our Privacy Policy explains how data is handled. Video never leaves your phone."],
      },
      {
        h: "Ownership",
        p: [`Upright, its design and its code belong to ${LEGAL_ENTITY}. The STEADI questions and tests come from the CDC; Upright is not affiliated with or endorsed by the CDC.`],
      },
      {
        h: "No warranties",
        p: ["Upright is provided \"as is\" and \"as available\", without warranties of any kind, to the extent the law allows."],
      },
      {
        h: "Limitation of liability",
        p: [`To the extent the law allows, ${LEGAL_ENTITY} is not liable for indirect, incidental or consequential damages, or for injuries during tests done without following the safety instructions. Nothing in these terms limits rights that the law does not allow to be limited.`],
      },
      {
        h: "Changes and ending",
        p: ["We may change Upright or these terms. If changes are important, we will show them in the app. You can stop using Upright at any time."],
      },
      {
        h: "Governing law",
        p: [`These terms are governed by the laws of the state where ${LEGAL_ENTITY} is incorporated, without regard to its conflict-of-law rules.`],
      },
      { h: "Contact", p: [contact("en")] },
    ],
  };
}
