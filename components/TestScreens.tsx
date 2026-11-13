/**
 * What TestRunner shows in each phase, as a pure function of its state, so the
 * screens can be rendered without a camera. TestRunner owns all logic, timing
 * and detectors; nothing here changes them.
 *
 * Phase -> screen: intro (placement) · position = Setup (gates) ·
 * instructions/countdown + the first moment after Go = GoCue ·
 * running = LiveTest · done/failed = TugResult (or the chair result).
 * Stop sits in the pinned bar on every test screen, never in the scroll.
 */
import type { ReactNode } from "react";
import { STRINGS, type Lang, type Strings } from "../lib/i18n";
import type { Gates } from "../lib/pose/usePoseCamera";
import type { ChairEntry, TugEntry } from "../lib/session";
import { ALGO, scoreChairStand, type Sex } from "../lib/signal/thresholds";
import { AppShell, PinnedRow } from "./AppShell";
import { SetupDiagram } from "./Diagram";
import { StatusBadge } from "./StatusBadge";
import { TugResultCard } from "./TugResultCard";

/** A camera error in plain words (the hook keeps the browser's error name, e.g. NotAllowedError). */
export function cameraErrorText(raw: string, t: Strings): string {
  if (/InsecureContext/.test(raw)) return t.camErrInsecure;
  if (/NotAllowedError|PermissionDenied|SecurityError|Permission denied/i.test(raw)) return t.camErrDenied;
  if (/NotFoundError|OverconstrainedError|DevicesNotFound/.test(raw)) return t.camErrNotFound;
  if (/NotReadableError|TrackStartError|AbortError/.test(raw)) return t.camErrInUse;
  return `${t.cameraError} ${raw}`;
}

export type TestKind = "tug" | "chair";
export type TestPhase = "intro" | "position" | "instructions" | "countdown" | "running" | "aborted" | "failed" | "done";

/** How long the giant Go stays on screen after the Go cue (display only; timing starts at the cue). */
export const GO_SHOW_S = 1;

/** Auto-start: how long a result stays on screen before moving on / retrying (display only). */
export const AUTO_NEXT_S = 6;

export interface GateRow {
  id: "body" | "person" | "fps" | "seated" | "arms" | "standing";
  ok: boolean;
  text: string;
}

/** Gate rows with plain-language fix messages, failing ones first (order otherwise kept). */
export function gateRows(kind: TestKind, gates: Gates, seated: boolean, armsCrossed: boolean, t: Strings): GateRow[] {
  const rows: GateRow[] = [
    {
      id: "body",
      ok: gates.bodyVisible,
      text: gates.bodyVisible
        ? t.gateBodyOk
        : gates.missing.length
          ? t.gateMissing(gates.missing.map((m) => t.parts[m]))
          : t.gateBodyBad,
    },
    {
      id: "person",
      ok: gates.people === 1,
      text: gates.people === 1 ? t.gateOnePerson : gates.people === 0 ? t.gateNoPerson : t.gateTwoPeople,
    },
    { id: "fps", ok: gates.fps >= ALGO.minFps, text: gates.fps >= ALGO.minFps ? t.gateFpsOk : t.gateFpsBad },
    { id: "seated", ok: seated, text: seated ? t.gateSeated : t.gateNotSeated },
  ];
  if (kind === "chair") rows.push({ id: "arms", ok: armsCrossed, text: armsCrossed ? t.gateArms : t.gateNoArms });
  return [...rows.filter((r) => !r.ok), ...rows.filter((r) => r.ok)];
}

export interface TestScreenProps {
  kind: TestKind;
  lang: Lang;
  onLang: (l: Lang) => void;
  phase: TestPhase;
  /** The camera stage element; kept in one slot so the video never remounts. */
  stage: ReactNode;
  camLoading: boolean;
  camError: string | null;
  /** Camera label + "try another camera", shown during the gate check. */
  camLine: ReactNode;
  rows: GateRow[];
  /** Placement advice that does not block the start (e.g. phone upright for the TUG). */
  tips?: string[];
  /** Why the start was paused (moved out of position), shown on the position screen. */
  notice?: string;
  /** Auto-start is on (Settings): the test starts by itself once everything holds green. */
  autoStart?: boolean;
  /** Auto-start: seconds until the app moves on (done) or retries (failed); null = not counting. */
  autoLeft?: number | null;
  /** All gates green right now / held long enough to start. */
  allOk: boolean;
  gateReady: boolean;
  countdown: number;
  elapsed: number;
  livePhaseLabel: string;
  liveCount: number;
  failMsg: string;
  abortNote: string;
  saved: TugEntry | ChairEntry | null;
  age: number;
  sex: Sex;
  canDownload: boolean;
  on: {
    check: () => void;
    skip: (reason: string) => void;
    backToIntro: () => void;
    begin: () => void;
    abort: () => void;
    redo: () => void;
    next: () => void;
    download: () => void;
    /** Leave the test from its intro (to the previous screen). */
    back?: () => void;
  };
}

export function TestScreen(p: TestScreenProps) {
  const t = STRINGS[p.lang];
  const { kind, phase } = p;
  const n = kind === "tug" ? 1 : 2;
  const name = kind === "tug" ? t.tugName : t.chairName;
  const instr = kind === "tug" ? t.tugInstr : t.chairInstr;
  const showCam = phase === "position" || phase === "instructions" || phase === "countdown" || phase === "running";
  const testing = phase === "instructions" || phase === "countdown" || phase === "running";
  const showGo = phase === "running" && p.elapsed < GO_SHOW_S;
  const firstFailing = p.rows.find((r) => !r.ok);

  const stop = (
    <button type="button" className="btn btn--stop" onClick={p.on.abort}>
      {t.abort}
    </button>
  );

  let pinned: ReactNode = null;
  if (phase === "intro") {
    pinned = (
      <PinnedRow back={p.on.back} backLabel={t.back}>
        <button type="button" className="btn btn--primary" onClick={p.on.check}>
          {t.checkPosition}
        </button>
      </PinnedRow>
    );
  } else if (phase === "position") {
    pinned = (
      <PinnedRow back={p.on.backToIntro} backLabel={t.back}>
        {p.allOk ? (
      <button type="button" className="btn btn--primary" disabled={!p.gateReady} onClick={p.on.begin}>
        {t.startTest}
      </button>
    ) : (
      <button
        type="button"
        className="btn btn--notready"
        aria-disabled="true"
        onClick={() => document.getElementById("gate-list")?.scrollIntoView({ block: "center" })}
      >
        {t.fixItems}
      </button>
    )}
      </PinnedRow>
    );
  } else if (testing) {
    pinned = stop;
  } else if (phase === "aborted" || phase === "failed") {
    pinned = (
      <button type="button" className="btn btn--primary" onClick={p.on.redo}>
        {t.redoTest}
      </button>
    );
  } else if (phase === "done") {
    pinned = (
      <button type="button" className="btn btn--primary" onClick={p.on.next}>
        {t.next}
      </button>
    );
  }

  return (
    <AppShell lang={p.lang} onLang={p.onLang} pinned={pinned} scrollKey={phase}>
      <p className="eyebrow">{t.testOf(n)}</p>
      {/* During the test the title shrinks so the timer and phase line stay above the pinned Stop. */}
      <h1 className={testing ? "h1 h1--compact" : "h1"}>{name}</h1>

      {/* Why the start was paused: first thing on screen. */}
      {phase === "position" && p.notice ? (
        <p className="callout" role="alert">
          {p.notice}
        </p>
      ) : null}

      {/* Setup: the gate sentence (first fix message) sits above the camera view. */}
      {phase === "position" && firstFailing ? <p className="live-status">{firstFailing.text}</p> : null}

      {/* GoCue: one full-width Go at the moment of the cue */}
      {showGo ? (
        <p className="go-cue" aria-hidden>
          {t.goBig}
        </p>
      ) : null}

      {/* LiveTest: big timer (or stand count) and the phase line */}
      {phase === "running" && !showGo ? (
        <div className="live" role="timer" aria-live="off">
          <p className="num timer">{kind === "chair" ? p.liveCount : p.elapsed.toFixed(1)}</p>
          <p className="live-status">
            {kind === "chair" ? `${Math.max(0, Math.ceil(30 - p.elapsed))} s` : p.livePhaseLabel}
          </p>
        </div>
      ) : null}

      {/* One slot for the camera so the video element is never remounted. */}
      {showCam ? (
        <>
          {p.camLoading ? <p className="muted">{t.loadingCamera}</p> : null}
          {p.camError ? <StatusBadge kind="risk">{cameraErrorText(p.camError, t)}</StatusBadge> : null}
          {p.stage}
        </>
      ) : null}

      {phase === "intro" && (
        <>
          <p className="muted">{kind === "tug" ? t.tugWhat : t.chairWhat}</p>
          <ol className="steps">
            {instr.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <h2 className="h2">{t.placementTitle}</h2>
          <p>{kind === "tug" ? t.tugPlace : t.chairPlace}</p>
          <SetupDiagram kind={kind} lang={p.lang} />
          <p className="note">{t.spotterTip}</p>
          <button type="button" className="linkish" onClick={() => p.on.skip("user skipped")}>
            {t.skipTest}
          </button>
        </>
      )}

      {phase === "position" && (
        <>
          {p.autoStart ? <p className="note">{t.autoStartNote}</p> : null}
          {p.camLine}
          <ul className="gate-list" id="gate-list" aria-live="polite">
            {p.rows.map((r) => (
              <li key={r.id}>
                <StatusBadge kind={r.ok ? "ok" : "risk"}>{r.text}</StatusBadge>
              </li>
            ))}
          </ul>
          {p.tips?.map((tip) => (
            <p key={tip} className="callout">
              {tip}
            </p>
          ))}
        </>
      )}

      {phase === "instructions" && (
        <>
          <p className="live-status">{t.readingInstr}</p>
          <p className="note">{t.stayPut}</p>
          <ol className="steps">
            {instr.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}

      {phase === "countdown" && <p className="live-status">{t.countdownReady}</p>}

      {phase === "running" && <p>{kind === "tug" ? t.tugRunning : t.chairRunning}</p>}

      {phase === "aborted" && (
        <>
          <StatusBadge kind="none">{p.abortNote || t.aborted}</StatusBadge>
          <button type="button" className="linkish" onClick={() => p.on.skip("stopped for safety")}>
            {t.skipTest}
          </button>
          {p.canDownload && (
            <button type="button" className="linkish" onClick={p.on.download}>
              {t.downloadData}
            </button>
          )}
        </>
      )}

      {phase === "failed" && (
        <>
          {p.autoLeft != null ? (
            <p className="callout" role="status">
              {t.autoRetryIn(p.autoLeft)}
            </p>
          ) : null}
          {kind === "tug" ? (
            <TugResultCard t={t} result={null} reason={p.failMsg} />
          ) : (
            <div className="card result">
              <StatusBadge kind="none">{t.badgeRefused}</StatusBadge>
              <p>{p.failMsg}</p>
            </div>
          )}
          <button type="button" className="linkish" onClick={() => p.on.skip("could not measure")}>
            {t.skipTest}
          </button>
          {p.canDownload && (
            <button type="button" className="linkish" onClick={p.on.download}>
              {t.downloadData}
            </button>
          )}
        </>
      )}

      {phase === "done" && p.saved && (
        <>
          {p.autoLeft != null ? (
            <p className="note" role="status">
              {t.autoNextIn(p.autoLeft)}
            </p>
          ) : null}
          <p className="muted">{t.autoMeasured}</p>
          {"totalSec" in p.saved ? (
            <TugResultCard t={t} result={p.saved} />
          ) : (
            <ChairResultCard t={t} entry={p.saved} age={p.age} sex={p.sex} />
          )}
          <button type="button" className="btn btn--secondary" onClick={p.on.redo}>
            {t.redoTest}
          </button>
          {p.canDownload && (
            <button type="button" className="linkish" onClick={p.on.download}>
              {t.downloadData}
            </button>
          )}
        </>
      )}
    </AppShell>
  );
}

/** Chair-stand result: score, then the CDC comparison as a status. */
export function ChairResultCard({ t, entry, age, sex }: { t: Strings; entry: ChairEntry; age: number; sex: Sex }) {
  if (entry.outcome === "refused" || entry.stands === null) {
    return (
      <div className="card result">
        <StatusBadge kind="none">{t.badgeRefused}</StatusBadge>
      </div>
    );
  }
  const sc = scoreChairStand(entry.stands, entry.armUse, age, sex);
  return (
    <div className="card result">
      <p className="result__number">
        <span className="num">{sc.score}</span>
      </p>
      <StatusBadge kind={sc.norm === null ? "none" : sc.belowAverage ? "risk" : "ok"}>
        {sc.norm === null ? t.chairNoNorm : sc.belowAverage ? t.chairBelow(sc.norm) : t.chairOk(sc.norm)}
      </StatusBadge>
      {entry.armUse && (
        <p>
          <b>{t.armsUsedResult}</b>
        </p>
      )}
      {entry.halfwayCounted && <p className="muted">{t.halfwayNote}</p>}
    </div>
  );
}
