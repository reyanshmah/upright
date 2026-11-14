"use client";

import { STRINGS, type Lang } from "../lib/i18n";
import { chairMeasured, isSkipped, tugMeasured, type SessionState } from "../lib/session";
import { exerciseTitle, planContext, reportFacts, stepDetail, stepOrder, STEP_TEXT } from "../lib/report";
import { TUG_RISK_SECONDS } from "../lib/signal/thresholds";
import { AppShell } from "./AppShell";
import { StatusBadge } from "./StatusBadge";
import { TugResultCard } from "./TugResultCard";
import { ChairResultCard } from "./TestScreens";
import { Icon } from "./Icon";
import type { ReportOutput } from "../lib/reportgen/schema";
import { BalanceTable } from "./BalanceRunner";

const R = {
  en: {
    title: "Results",
    higher: "These results suggest a higher risk of falling.",
    lower: "No fall risk signs were found today.",
    screen: "Screening questions",
    tug: "Timed Up and Go",
    chair: "30-Second Chair Stand",
    balance: "4-Stage Balance",
    atRisk: "At risk",
    ok: "OK",
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
    balance: "Equilibrio en 4 etapas",
    atRisk: "En riesgo",
    ok: "Bien",
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

/** The results screen as a pure function of the session (the page loads it and wires navigation). */
/** The family plan's state: the on-device plan shows at once; a checked AI plan replaces it if one arrives. */
export type PlanState =
  | { state: "loading" }
  | { state: "ai"; output: ReportOutput }
  | { state: "standard"; reason?: "no_key" | "checks" | "error" }
  | { state: "offline" };

export function ResultsView({
  s,
  onLang,
  onRedoTug,
  onNewScreen,
  plan = { state: "standard" },
}: {
  s: SessionState;
  onLang: (l: Lang) => void;
  onRedoTug: () => void;
  onNewScreen: () => void;
  plan?: PlanState;
}) {
  const lang = s.lang;
  const t = STRINGS[lang];
  const r = R[lang];
  const f = reportFacts(s);
  const steps = stepOrder(f);
  const ctx = planContext(s);
  const yesCount = [s.screening.unsteady, s.screening.worry, s.screening.fallen].filter(Boolean).length;
  const tug = tugMeasured(s.tug);
  const chair = chairMeasured(s.chair);
  // A refused run carries no number: say so instead of calling it "skipped".
  const tugEntry = s.tug && !isSkipped(s.tug) ? s.tug : null;
  const chairEntry = s.chair && !isSkipped(s.chair) ? s.chair : null;
  const tugRefused = tugEntry?.outcome === "refused";
  const chairRefused = chairEntry?.outcome === "refused";
  const bal = s.balance && !isSkipped(s.balance) ? s.balance : null;
  const balReached = bal ? Math.max(0, ...bal.stages.filter((x) => x.completed).map((x) => x.stage)) : 0;
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

  const pinned = tugRefused ? (
    <button type="button" className="btn btn--primary" onClick={onRedoTug}>
      {t.redoTest}
    </button>
  ) : (
    <button
      type="button"
      className="btn btn--primary"
      onClick={() => document.getElementById("plan")?.scrollIntoView({ block: "start" })}
    >
      {t.seePlan}
    </button>
  );

  return (
    <AppShell lang={lang} onLang={onLang} pinned={pinned}>
      <section className="family stack">
        <h1 className="h1">
          {name ? `${name}: ` : ""}
          {r.title}
        </h1>
        <StatusBadge kind={f.higherRisk ? "risk" : "ok"}>{f.higherRisk ? r.higher : r.lower}</StatusBadge>

        <h2 className="h2">{r.screen}</h2>
        <div className="card result">
          <p>{r.yesAnswers(yesCount)}</p>
          <StatusBadge kind={f.screenedAtRisk ? "risk" : "ok"}>{f.screenedAtRisk ? r.atRisk : r.ok}</StatusBadge>
        </div>

        <h2 className="h2">{r.tug}</h2>
        {tugEntry ? (
          <TugResultCard
            t={t}
            result={tugEntry}
            reason={tugEntry.refusalReason ? t.refusalReasons[tugEntry.refusalReason] : undefined}
          />
        ) : (
          <StatusBadge kind="none">{r.skipped}</StatusBadge>
        )}

        <h2 className="h2">{r.chair}</h2>
        {chairEntry ? (
          <ChairResultCard t={t} entry={chairEntry} age={s.profile.age} sex={s.profile.sex} />
        ) : (
          <StatusBadge kind="none">{r.skipped}</StatusBadge>
        )}

        <h2 className="h2">{r.balance}</h2>
        {bal ? (
          <div className="card result">
            <StatusBadge kind={bal.tandemHeld10 ? "ok" : "risk"}>
              {bal.tandemHeld10 ? t.balTandemOk : t.balTandemRisk}
            </StatusBadge>
            <BalanceTable result={bal} t={t} />
          </div>
        ) : (
          <StatusBadge kind="none">{r.skipped}</StatusBadge>
        )}

        <h2 className="h2" id="plan">
          {r.planTitle}
        </h2>
        {f.injuredFall && <p className="callout callout--error">{t.resultInjured}</p>}
        {f.multipleFalls && <p className="callout callout--error">{t.resultTwoPlus}</p>}
        {plan.state === "ai" && <p className="note plan-summary">{plan.output.familySummary}</p>}
        <ol className="plan">
          {plan.state === "ai"
            ? plan.output.familySteps.map((st, i) => (
                <li key={i}>
                  <b>{st.title}</b>
                  <p>{st.body}</p>
                </li>
              ))
            : steps.map((k) => {
                const detail = stepDetail(k, ctx, lang);
                return (
                  <li key={k}>
                    <b>{k === "exercise" ? exerciseTitle(ctx, lang) : STEP_TEXT[lang][k].title}</b>
                    {detail && (
                      <p className="plan-detail">
                        <b>{t.planForYou}</b> {detail}
                      </p>
                    )}
                    <p>{STEP_TEXT[lang][k].body}</p>
                  </li>
                );
              })}
        </ol>
        {(plan.state !== "standard" || plan.reason) && (
          <p className="footnote" aria-live="polite">
            <Icon name={plan.state === "loading" ? "clock" : "info"} size={20} />
            <span>
              {plan.state === "loading"
                ? t.reportWriting
                : plan.state === "offline"
                  ? t.reportOffline
                  : plan.state === "ai"
                    ? t.reportAi
                    : plan.reason === "no_key"
                      ? t.reportNoKey
                      : plan.reason === "checks"
                        ? t.reportChecks
                        : t.reportError}
            </span>
          </p>
        )}

        <button type="button" className="btn btn--secondary" onClick={printClinician}>
          {r.print}
        </button>
        <button type="button" className="btn btn--secondary" onClick={download}>
          {r.download}
        </button>
        <p className="muted">{r.clinicianNote}</p>
      </section>

      {/* Always English, one page */}
      <section className="clinician card" lang="en">
        <h2 className="h2">Upright — home fall-risk screen (CDC STEADI)</h2>
        {plan.state === "ai" && <p>{plan.output.clinicianSummary}</p>}
        <p className="small">
          Date: {date.toLocaleDateString("en-US")} · Run by: {s.runner === "helper" ? "family member/helper" : "self"} ·
          Language: {lang === "es" ? "Spanish" : "English"}
        </p>
        <table>
          <tbody>
            <tr><th>Patient</th><td>{name || "—"}, age {s.profile.age}, {s.profile.sex}, walking aid: {s.profile.walkingAid}</td></tr>
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
                    <b>{tug.totalSec.toFixed(1)} s</b> ({tug.totalSec >= TUG_RISK_SECONDS ? `≥ ${TUG_RISK_SECONDS} s: at risk` : `< ${TUG_RISK_SECONDS} s`}) ·
                    Measured automatically (on-device pose, timed from the “Go” cue to seated)
                    {tug.outcome === "full" && tug.phases
                      ? ` · Phases: stand up ${tug.phases.standUp.toFixed(1)} s, walk out ${tug.phases.walkOut.toFixed(1)} s, turn ${tug.phases.turn.toFixed(1)} s, walk back ${tug.phases.walkBack.toFixed(1)} s, sit down ${tug.phases.sitDown.toFixed(1)} s`
                      : " · Phase breakdown hidden (the camera could not see every step)"}
                  </>
                ) : (
                  tugRefused
                    ? `Could not be measured (${(tugEntry?.refusalReason ?? "—").replace(/_/g, " ")}); no time recorded`
                    : `Not done (${s.tug && isSkipped(s.tug) ? s.tug.reason : "—"})`
                )}
              </td>
            </tr>
            <tr>
              <th>30-s Chair Stand</th>
              <td>
                {chair ? (
                  <>
                    <b>Score {f.chairScore}</b>{chair.armUse ? " (arms used to rise → 0 per CDC form)" : ` (${chair.stands} stands${chair.halfwayCounted ? ", last counted by the halfway rule" : ""})`} ·
                    {f.chairNorm === null ? " no CDC norm for age" : ` CDC below-average cutoff < ${f.chairNorm}: ${f.chairBelow ? "below average" : "not below"}`} ·
                    Counted automatically (on-device pose)
                  </>
                ) : (
                  chairRefused
                    ? `Could not be measured (${(chairEntry?.refusalReason ?? "—").replace(/_/g, " ")}); no score recorded`
                    : `Not done (${s.chair && isSkipped(s.chair) ? s.chair.reason : "—"})`
                )}
              </td>
            </tr>
            <tr>
              <th>4-Stage Balance</th>
              <td>
                {bal ? (
                  <>
                    {bal.stages.map((x) => `Stage ${x.stage}: ${x.heldS.toFixed(1)} s${x.completed ? "" : " (feet moved)"}${x.stanceVerified ? "" : " (stance not camera-confirmed)"}${x.sway !== null ? `, sway ${x.sway.toFixed(3)} hip widths` : ""}`).join(" · ")}
                    {" "}→ <b>{bal.tandemHeld10 ? "tandem held 10 s" : "could not hold tandem 10 s: increased fall risk (CDC)"}</b>
                    {` · highest position completed: ${balReached || "none"}`}
                  </>
                ) : (
                  `Not done (${s.balance && isSkipped(s.balance) ? s.balance.reason : "—"})`
                )}
              </td>
            </tr>
            <tr>
              <th>Quality</th>
              <td>
                Measurement quality — TUG: {tug ? (tug.outcome === "full" ? "full" : "total time only") : tugRefused ? "could not measure" : "—"}
                {tug ? ` (timing ±${tug.timingErrorSec.toFixed(2)} s)` : ""}, chair stand: {chair ? "full" : chairRefused ? "could not measure" : "—"} ·
                Median fps: {tug?.medianFps ? tug.medianFps.toFixed(0) : "—"} / {chair?.medianFps ? chair.medianFps.toFixed(0) : "—"} ·
                3 m line: {s.setup?.lineMethod === "ar" ? `phone AR (ARCore), ${s.setup.cameraMeasuredM?.toFixed(2)} m` : s.setup?.lineMethod === "pose" ? `camera estimate (pose, approximate), ${s.setup.cameraMeasuredM?.toFixed(2)} m` : s.setup?.lineMethod === "tape" ? "tape measure" : s.setup?.lineMethod === "app" ? "iPhone Measure app" : "—"} ·
                Camera: {[tug?.camera, chair?.camera, bal?.camera].filter(Boolean).map((c) => `${c!.wide ? "wide " : ""}${c!.zoom ? `${c!.zoom}× ` : ""}${c!.label || "back camera"}`).filter((v, i, a) => a.indexOf(v) === i).join("; ") || "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="small">
          Home screening aid, not a diagnosis; share results with your doctor. Thresholds from CDC STEADI forms (TUG ≥ 12 s; 30-Second Chair Stand
          below-average scores by age and sex; 4-Stage Balance tandem stance &lt; 10 s). Administered at home by a non-clinician.
        </p>
      </section>

      <button type="button" className="btn btn--secondary" onClick={onNewScreen}>
        {r.newScreen}
      </button>
    </AppShell>
  );
}
