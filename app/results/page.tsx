"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS } from "@/lib/i18n";
import { clearSession, isSkipped, loadSession, type SessionState } from "@/lib/session";
import { reportFacts, stepOrder, STEP_TEXT } from "@/lib/report";
import { TUG_RISK_SECONDS } from "@/lib/signal/thresholds";
import { cmToFtIn } from "@/lib/measure";
import { PhaseBars } from "@/components/TestRunner";

const R = {
  en: {
    title: "Results",
    higher: "These results suggest a higher risk of falling.",
    lower: "No fall risk signs were found today.",
    screen: "Screening questions",
    tug: "Timed Up and Go",
    chair: "30-Second Chair Stand",
    atRisk: "At risk",
    ok: "OK",
    below: "Below average",
    noNorm: "No CDC norm for age",
    skipped: "Skipped",
    yesAnswers: (n: number) => (n === 1 ? "1 yes answer" : `${n} yes answers`),
    planTitle: "Family action plan",
    clinicianTitle: "Clinician summary",
    clinicianNote: "Print or save this page as a PDF and bring it to the next doctor visit.",
    print: "Print / save clinician summary",
    download: "Download results data (no name)",
    newScreen: "Start a new screening",
  },
  es: {
    title: "Resultados",
    higher: "Estos resultados sugieren un riesgo mayor de caídas.",
    lower: "Hoy no se encontraron señales de riesgo de caídas.",
    screen: "Preguntas de detección",
    tug: "Levántate y Anda",
    chair: "Levantarse de la silla (30 s)",
    atRisk: "En riesgo",
    ok: "Bien",
    below: "Bajo el promedio",
    noNorm: "Sin norma de los CDC para la edad",
    skipped: "Omitida",
    yesAnswers: (n: number) => (n === 1 ? "1 respuesta sí" : `${n} respuestas sí`),
    planTitle: "Plan de acción para la familia",
    clinicianTitle: "Resumen para el médico (en inglés)",
    clinicianNote: "Imprima o guarde esta página como PDF y llévela a la próxima cita.",
    print: "Imprimir / guardar el resumen",
    download: "Descargar datos de resultados (sin nombre)",
    newScreen: "Empezar una nueva evaluación",
  },
};

export default function Results() {
  const router = useRouter();
  const [s, setS] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setS(loadSession());
    setLoaded(true);
  }, []);
  if (!loaded) return <main />;
  if (!s) {
    return (
      <main>
        <p>No results yet.</p>
        <Link className="btn" href="/start">Start</Link>
      </main>
    );
  }

  const lang = s.lang;
  const t = STRINGS[lang];
  const r = R[lang];
  const f = reportFacts(s);
  const steps = stepOrder(f);
  const yesCount = [s.screening.unsteady, s.screening.worry, s.screening.fallen].filter(Boolean).length;
  const tug = s.tug && !isSkipped(s.tug) ? s.tug : null;
  const chair = s.chair && !isSkipped(s.chair) ? s.chair : null;
  const name = s.profile.firstName;
  const date = new Date(s.createdAt);

  const printClinician = () => {
    document.body.dataset.print = "clinician";
    window.print();
    setTimeout(() => delete document.body.dataset.print, 500);
  };

  const download = () => {
    const { profile, ...rest } = s;
    const { firstName: _omit, ...anonProfile } = profile;
    const blob = new Blob([JSON.stringify({ ...rest, profile: anonProfile }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `upright-results-${date.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chip = (state: "risk" | "ok" | "na", label: string) => (
    <span className={`chip ${state}`}>{label}</span>
  );

  return (
    <main lang={lang}>
      <section className="family">
        <h1>{name ? `${name}: ` : ""}{r.title}</h1>
        <div className={`card ${f.higherRisk ? "warn" : "okcard"}`}>
          <p className="big">{f.higherRisk ? r.higher : r.lower}</p>
        </div>

        <ul className="summary">
          <li>
            <span>{r.screen}</span>
            <span>
              {r.yesAnswers(yesCount)} {chip(f.screenedAtRisk ? "risk" : "ok", f.screenedAtRisk ? r.atRisk : r.ok)}
            </span>
          </li>
          <li>
            <span>{r.tug}</span>
            <span>
              {f.tugS === null
                ? chip("na", r.skipped)
                : <>{f.tugS.toFixed(1)} s {chip(f.tugAtRisk ? "risk" : "ok", f.tugAtRisk ? r.atRisk : r.ok)}</>}
            </span>
          </li>
          <li>
            <span>{r.chair}</span>
            <span>
              {f.chairScore === null
                ? chip("na", r.skipped)
                : <>{f.chairScore} {f.chairBelow === null
                    ? chip("na", r.noNorm)
                    : chip(f.chairBelow ? "risk" : "ok", f.chairBelow ? r.below : r.ok)}</>}
            </span>
          </li>
        </ul>

        {tug?.phases && <PhaseBars phases={tug.phases} t={t} />}

        <h2>{r.planTitle}</h2>
        {f.injuredFall && <p className="note"><b>{t.resultInjured}</b></p>}
        {f.multipleFalls && <p className="note"><b>{t.resultTwoPlus}</b></p>}
        <ol className="plan">
          {steps.map((k) => (
            <li key={k}>
              <b>{STEP_TEXT[lang][k].title}</b>
              <p>{STEP_TEXT[lang][k].body}</p>
            </li>
          ))}
        </ol>

        <div className="row">
          <button className="btn" onClick={printClinician}>{r.print}</button>
          <button className="btn secondary" onClick={download}>{r.download}</button>
        </div>
        <p className="muted small">{r.clinicianNote}</p>
      </section>

      {/* Always English, one page */}
      <section className="clinician" lang="en">
        <h2>Upright — home fall-risk screen (CDC STEADI)</h2>
        <p className="small">
          Date: {date.toLocaleDateString("en-US")} · Run by: {s.runner === "helper" ? "family member/helper" : "self"} ·
          Language: {lang === "es" ? "Spanish" : "English"}
        </p>
        <table>
          <tbody>
            <tr><th>Patient</th><td>{name || "—"}, age {s.profile.age}, {s.profile.sex}, height {s.profile.heightCm} cm ({cmToFtIn(s.profile.heightCm)}), walking aid: {s.profile.walkingAid}</td></tr>
            <tr>
              <th>STEADI screen</th>
              <td>
                Unsteady standing/walking: {s.screening.unsteady ? "yes" : "no"} · Worries about falling: {s.screening.worry ? "yes" : "no"} ·
                Fallen in past year: {s.screening.fallen ? `yes (${s.screening.fallCount} time(s), injured: ${s.screening.injured ? "yes" : "no"})` : "no"}
                {" "}→ <b>{f.screenedAtRisk ? "screened at risk" : "screened not at risk"}</b>
              </td>
            </tr>
            <tr>
              <th>Timed Up and Go</th>
              <td>
                {tug ? (
                  <>
                    <b>{tug.totalS.toFixed(1)} s</b> ({tug.totalS >= TUG_RISK_SECONDS ? `≥ ${TUG_RISK_SECONDS} s: at risk` : `< ${TUG_RISK_SECONDS} s`}) ·
                    Measured automatically (on-device pose, timed from the “Go” cue to seated)
                    {tug.phases
                      ? ` · Phases: stand up ${tug.phases.standUp.toFixed(1)} s, walk out ${tug.phases.walkOut.toFixed(1)} s, turn ${tug.phases.turn.toFixed(1)} s, walk back ${tug.phases.walkBack.toFixed(1)} s, sit down ${tug.phases.sitDown.toFixed(1)} s`
                      : " · Phase breakdown unavailable"}
                  </>
                ) : (
                  `Not done (${s.tug && isSkipped(s.tug) ? s.tug.reason : "—"})`
                )}
              </td>
            </tr>
            <tr>
              <th>30-s Chair Stand</th>
              <td>
                {chair ? (
                  <>
                    <b>Score {f.chairScore}</b>{chair.armsUsed ? " (arms used to rise → 0 per CDC form)" : ` (${chair.count} stands${chair.halfwayCounted ? ", last counted by the halfway rule" : ""})`} ·
                    {f.chairNorm === null ? " no CDC norm for age" : ` CDC below-average cutoff < ${f.chairNorm}: ${f.chairBelow ? "below average" : "not below"}`} ·
                    Counted automatically (on-device pose)
                  </>
                ) : (
                  `Not done (${s.chair && isSkipped(s.chair) ? s.chair.reason : "—"})`
                )}
              </td>
            </tr>
            <tr>
              <th>Quality</th>
              <td>
                Camera gates (whole body, one person, ≥15 fps) passed during TUG: {tug ? (tug.gatesPassed ? "yes" : "no") : "—"}, chair stand: {chair ? (chair.gatesPassed ? "yes" : "no") : "—"} ·
                Median fps: {tug?.fpsMedian ? tug.fpsMedian.toFixed(0) : "—"} / {chair?.fpsMedian ? chair.fpsMedian.toFixed(0) : "—"} ·
                3 m line: {s.setup?.lineMethod === "ar" ? `phone AR (ARCore), ${s.setup.cameraMeasuredM?.toFixed(2)} m` : s.setup?.lineMethod === "tape" ? "tape measure" : "—"} ·
                Camera: {[tug?.camera, chair?.camera].filter(Boolean).map((c) => `${c!.wide ? "wide " : ""}${c!.zoom ? `${c!.zoom}× ` : ""}${c!.label || "back camera"}`).filter((v, i, a) => a.indexOf(v) === i).join("; ") || "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="small">
          Home screening aid, not a diagnosis. Thresholds from CDC STEADI forms (TUG ≥ 12 s; 30-Second Chair Stand
          below-average scores by age and sex). Administered at home by a non-clinician.
        </p>
      </section>

      <div className="row nav">
        <button
          className="btn secondary"
          onClick={() => {
            clearSession();
            router.push("/start");
          }}
        >
          {r.newScreen}
        </button>
      </div>
      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}
