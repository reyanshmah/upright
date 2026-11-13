"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage } from "@/components/CameraStage";
import { CameraControls } from "@/components/CameraControls";
import { AppShell, PinnedRow } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { AUTO_NEXT_S, cameraErrorText, gateRows, type GateRow } from "@/components/TestScreens";
import { playCue, playCueAndWait, stopCues, unlockAudio, type CueId } from "@/lib/voice";
import { getAutoStart } from "@/lib/displayPrefs";
import { BalanceDetector, FrontFeatures, HOLD_S, tandemHeld10, type Stage } from "@/lib/analysis/balance";
import { angleDeg } from "@/lib/signal/geometry";
import { StableFlag } from "@/lib/signal/gate";
import { BALANCE, GATES } from "@/lib/signal/thresholds";
import { LM, type LandmarkStream, type PoseFrame } from "@/lib/signal/types";
import type { BalanceResult } from "@/lib/session";

type Phase = "intro" | "position" | "running" | "aborted" | "failed" | "done";
type StageView = "instr" | "wait" | "hold" | "held" | "moved";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BalanceRunner({
  lang,
  onLang,
  onSaved,
  onSkip,
  onNext,
  onBack,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  onSaved: (r: BalanceResult) => void;
  onSkip: (reason: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const t = STRINGS[lang];
  const [phase, setPhase] = useState<Phase>("intro");
  const [stage, setStage] = useState<Stage>(1);
  const [view, setView] = useState<StageView>("instr");
  const [holdS, setHoldS] = useState(0);
  const [standing, setStanding] = useState(false);
  const [gateHeldMs, setGateHeldMs] = useState(0);
  const [saved, setSaved] = useState<BalanceResult | null>(null);

  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const fx = useRef<FrontFeatures | null>(null);
  const det = useRef(new BalanceDetector());
  // Same on/off hold as the seated check in the other tests.
  const standFlag = useRef(new StableFlag(GATES.seated.onMs, GATES.seated.offMs));
  const gateSince = useRef<number | null>(null);
  const frameOk = useRef({ ok: 0, total: 0 });
  const aborted = useRef(false);
  const stream = useRef<LandmarkStream | null>(null);
  /** Settings > Start the test: automatically once standing has held green. */
  const [autoStart, setAutoStartOn] = useState(false);
  const autoStartRef = useRef(false);

  const onFrame = (f: FrameInfo) => {
    const p = phaseRef.current;
    if (!fx.current) fx.current = new FrontFeatures(f.w, f.h);
    const feat = fx.current.push(f.t, f.main);

    if (p === "position") {
      let up = false;
      if (f.main) {
        const m = f.main;
        const kl = angleDeg(m[LM.leftHip], m[LM.leftKnee], m[LM.leftAnkle], f.w, f.h);
        const kr = angleDeg(m[LM.rightHip], m[LM.rightKnee], m[LM.rightAnkle], f.w, f.h);
        up = kl > BALANCE.standKneeDeg && kr > BALANCE.standKneeDeg;
      }
      const s = standFlag.current.update(up, f.t);
      setStanding(s);
      if (f.gatesOk && s) {
        gateSince.current ??= f.t;
        setGateHeldMs(f.t - gateSince.current);
        // Auto-start: begin the moment Start would light up (same hold as the button).
        if (autoStartRef.current && f.t - gateSince.current >= GATES.allGreenHoldMs) void run();
      } else {
        gateSince.current = null;
        setGateHeldMs(0);
      }
    }

    if (p === "running") {
      frameOk.current.total++;
      if (f.bodyOk && f.fpsOk) frameOk.current.ok++;
      det.current.push(feat, f.t);
      if (det.current.status === "holding") setHoldS(det.current.heldS);
    }
  };
  const cam = usePoseCamera(onFrame);

  const openCamera = () => {
    unlockAudio(lang);
    autoStartRef.current = getAutoStart() === "on";
    setAutoStartOn(autoStartRef.current);
    fx.current = null;
    gateSince.current = null;
    setGateHeldMs(0);
    // A redo starts from nothing: no stale "standing" check.
    setStanding(false);
    standFlag.current.reset();
    setPhase("position");
    void cam.start("environment");
  };

  // Auto-start: open the camera without the "Check position" tap.
  useEffect(() => {
    if (getAutoStart() === "on") openCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start: after the result, go on to the results; after a failed run, try again.
  const [autoLeft, setAutoLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!autoStartRef.current || (phase !== "done" && phase !== "failed")) {
      setAutoLeft(null);
      return;
    }
    let left = AUTO_NEXT_S;
    setAutoLeft(left);
    const id = setInterval(() => {
      left -= 1;
      setAutoLeft(left);
      if (left <= 0) {
        clearInterval(id);
        if (phase === "done") onNext();
        else openCamera();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Wait until pred() is true (or the test was stopped). */
  const waitFor = async (pred: () => boolean) => {
    while (!pred() && !aborted.current) {
      // Keep the detector ticking even if frames stall (tracking lost).
      det.current.push(null, performance.now());
      await sleep(100);
    }
  };

  // Read live (TypeScript would otherwise narrow this across awaits).
  const st = (): string => det.current.status;

  const run = async () => {
    if (phaseRef.current !== "position") return; // already started (auto-start fires on every frame)
    phaseRef.current = "running";
    unlockAudio(lang);
    aborted.current = false;
    det.current = new BalanceDetector();
    frameOk.current = { ok: 0, total: 0 };
    cam.startRecording();
    setPhase("running");
    setView("instr");
    await playCueAndWait(lang, "balIntro", t.balSpokenIntro);

    for (const s of [1, 2, 3, 4] as Stage[]) {
      if (aborted.current) return;
      setStage(s);
      setHoldS(0);
      setView("instr");
      await playCueAndWait(lang, `bal${s}` as CueId, t.balStages[s]);
      if (aborted.current) return;
      det.current.startStage(s, performance.now());
      setView("wait");
      await waitFor(() => st() !== "waitStance");
      if (aborted.current) return;
      if (st() === "lost") return fail();
      setView("hold");
      void playCue(lang, "hold", t.balHold);
      await waitFor(() => ["held", "failed", "lost"].includes(st()));
      if (aborted.current) return;
      if (st() === "lost") return fail();
      if (st() === "failed") {
        setView("moved");
        void playCue(lang, "stop", t.cueStop);
        await sleep(1200);
        break; // CDC: if they can't hold a position, stop the test
      }
      setView("held");
      setHoldS(HOLD_S);
      void playCue(lang, "good", t.balGood);
      await sleep(1500);
    }
    finish();
  };

  const recording = () => {
    const { frames, fpsMedian } = cam.stopRecording();
    const { w, h } = cam.videoSize();
    stream.current = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}-balance`,
      goCueT: det.current.events[0]?.t ?? null,
      videoWidth: w,
      videoHeight: h,
      frames: frames as PoseFrame[],
      events: det.current.events,
    };
    return fpsMedian;
  };

  const fail = () => {
    recording();
    cam.stop();
    setPhase("failed");
  };

  const finish = () => {
    const fpsMedian = recording();
    cam.stop();
    const { ok, total } = frameOk.current;
    const results = det.current.results;
    const r: BalanceResult = {
      stages: results.map((x) => ({ ...x })),
      tandemHeld10: tandemHeld10(results),
      source: "auto",
      fpsMedian,
      gatesPassed: total > 0 && ok / total >= 0.9,
      ...(cam.camera ? { camera: { label: cam.camera.label, zoom: cam.camera.zoom, wide: cam.camera.wide } } : {}),
    };
    setSaved(r);
    onSaved(r);
    setPhase("done");
  };

  const abort = () => {
    aborted.current = true;
    cam.stopRecording();
    cam.stop();
    stopCues();
    setPhase("aborted");
  };

  const downloadStream = () => {
    if (!stream.current) return;
    const blob = new Blob([JSON.stringify(stream.current)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${stream.current.sessionId}.landmarks.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Same hold as the Start button in the other tests (lib/signal/thresholds.ts).
  const gateReady = gateHeldMs >= GATES.allGreenHoldMs;
  const remaining = Math.max(0, Math.ceil(HOLD_S - holdS));

  // Same gate rows as the other tests, with "standing" in place of "seated".
  const rows: GateRow[] = [
    ...gateRows("tug", cam.gates, true, false, t).filter((r) => r.id !== "seated"),
    { id: "standing" as const, ok: standing, text: standing ? t.gateStanding : t.gateNotStanding },
  ].sort((x, y) => Number(x.ok) - Number(y.ok));
  const allOk = rows.every((r) => r.ok);
  const firstFailing = rows.find((r) => !r.ok);
  const showCam = phase === "position" || phase === "running";
  const viewLabel =
    view === "hold" ? t.balHoldLabel : view === "wait" ? t.balGetInto : view === "held" ? t.balGood : view === "moved" ? t.balFoot : "";

  let pinned: ReactNode = null;
  if (phase === "intro") {
    pinned = (
      <PinnedRow back={onBack} backLabel={t.back}>
        <button type="button" className="btn btn--primary" onClick={openCamera}>
          {t.checkPosition}
        </button>
      </PinnedRow>
    );
  } else if (phase === "position") {
    pinned = (
      <PinnedRow back={() => { cam.stop(); setPhase("intro"); }} backLabel={t.back}>
        {allOk ? (
      <button type="button" className="btn btn--primary" disabled={!gateReady} onClick={() => void run()}>
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
  } else if (phase === "running") {
    pinned = (
      <button type="button" className="btn btn--stop" onClick={abort}>
        {t.abort}
      </button>
    );
  } else if (phase === "aborted" || phase === "failed") {
    pinned = (
      <button type="button" className="btn btn--primary" onClick={openCamera}>
        {t.redoTest}
      </button>
    );
  } else if (phase === "done") {
    pinned = (
      <button type="button" className="btn btn--primary" onClick={onNext}>
        {t.seeResults}
      </button>
    );
  }

  return (
    <AppShell lang={lang} onLang={onLang} pinned={pinned} scrollKey={phase}>
      <p className="eyebrow">{t.testOf(3)}</p>
      <h1 className={phase === "running" ? "h1 h1--compact" : "h1"}>{t.balName}</h1>

      {phase === "position" && firstFailing ? <p className="live-status">{firstFailing.text}</p> : null}

      {phase === "running" ? (
        <div className="live" role="timer" aria-live="off">
          {view === "hold" ? <p className="num timer">{remaining}</p> : null}
          <p className="live-status">
            {t.balStageLabel(stage)}
            {viewLabel ? `: ${viewLabel}` : ""}
          </p>
        </div>
      ) : null}

      {phase === "running" && (
        <div className="stance-card">
          <StanceIcon stage={stage} big />
          <p className="instruction">{t.balStages[stage]}</p>
        </div>
      )}

      {/* One slot for the camera so the video element is never remounted. */}
      {showCam ? (
        <>
          {cam.status === "loading" ? <p className="muted">{t.loadingCamera}</p> : null}
          {cam.error ? <StatusBadge kind="risk">{cameraErrorText(cam.error, t)}</StatusBadge> : null}
          <CameraStage videoRef={cam.videoRef} canvasRef={cam.canvasRef} mirror={cam.facing === "user"} maxHeight={phase === "position" ? "55dvh" : "40dvh"} overlay={null} />
        </>
      ) : null}

      {phase === "intro" && (
        <>
          <p className="muted">{t.balWhat}</p>
          <ol className="steps">
            {([1, 2, 3, 4] as Stage[]).map((s) => (
              <li key={s}>
                <StanceIcon stage={s} /> {t.balStages[s]}
              </li>
            ))}
          </ol>
          <ul className="small-list">
            {t.balRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <h2 className="h2">{t.placementTitle}</h2>
          <p>{t.balPlace}</p>
          <p className="note">{t.spotterTip}</p>
          <button type="button" className="linkish" onClick={() => onSkip("user skipped")}>
            {t.skipTest}
          </button>
        </>
      )}

      {phase === "position" && (
        <>
          {autoStart ? <p className="note">{t.autoStartNote}</p> : null}
          {cam.camera && <CameraControls cam={cam} lang={lang} onChange={() => { fx.current = null; }} />}
          <ul className="gate-list" id="gate-list" aria-live="polite">
            {rows.map((r) => (
              <li key={r.id}>
                <StatusBadge kind={r.ok ? "ok" : "risk"}>{r.text}</StatusBadge>
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "aborted" && (
        <>
          <StatusBadge kind="none">{t.aborted}</StatusBadge>
          <button type="button" className="linkish" onClick={() => onSkip("stopped for safety")}>
            {t.skipTest}
          </button>
        </>
      )}

      {phase === "failed" && (
        <>
          {autoLeft != null ? (
            <p className="callout" role="status">
              {t.autoRetryStandIn(autoLeft)}
            </p>
          ) : null}
          <div className="card result">
            <StatusBadge kind="none">{t.badgeRefused}</StatusBadge>
            <p>{t.balLost}</p>
          </div>
          <button type="button" className="linkish" onClick={() => onSkip("could not measure")}>
            {t.skipTest}
          </button>
          {stream.current && (
            <button type="button" className="linkish" onClick={downloadStream}>
              {t.downloadData}
            </button>
          )}
        </>
      )}

      {phase === "done" && saved && (
        <>
          {autoLeft != null ? (
            <p className="note" role="status">
              {t.autoResultsIn(autoLeft)}
            </p>
          ) : null}
          <p className="muted">{t.autoMeasured}</p>
          <div className="card result">
            <StatusBadge kind={saved.tandemHeld10 ? "ok" : "risk"}>
              {saved.tandemHeld10 ? t.balTandemOk : t.balTandemRisk}
            </StatusBadge>
            <BalanceTable result={saved} t={t} />
          </div>
          <button type="button" className="btn btn--secondary" onClick={openCamera}>
            {t.redoTest}
          </button>
          {stream.current && (
            <button type="button" className="linkish" onClick={downloadStream}>
              {t.downloadData}
            </button>
          )}
        </>
      )}
    </AppShell>
  );
}

export function BalanceTable({ result, t }: { result: BalanceResult; t: (typeof STRINGS)["en"] }) {
  return (
    <ul className="rows">
      {([1, 2, 3, 4] as Stage[]).map((s) => {
        const r = result.stages.find((x) => x.stage === s);
        return (
          <li key={s}>
            <span>
              <StanceIcon stage={s} /> {t.balStageLabel(s)}
            </span>
            <span>
              {r ? (
                <StatusBadge kind={r.completed ? "ok" : "risk"}>
                  {r.completed ? t.balHeld(r.heldS.toFixed(1)) : `${t.balHeld(r.heldS.toFixed(1))}, ${t.balFoot}`}
                </StatusBadge>
              ) : (
                <StatusBadge kind="none">{t.skipped}</StatusBadge>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Tiny top-down foot diagrams for the four CDC stances. */
export function StanceIcon({ stage, big }: { stage: Stage; big?: boolean }) {
  const foot = (x: number, y: number, key: string, faded = false) => (
    <rect key={key} x={x} y={y} width="9" height="20" rx="4.5" fill={faded ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.5" strokeDasharray={faded ? "2 2" : undefined} />
  );
  const feet =
    stage === 1 ? [foot(9, 8, "a"), foot(20, 8, "b")]
    : stage === 2 ? [foot(10, 4, "a"), foot(18, 14, "b")]
    : stage === 3 ? [foot(15, 0, "a"), foot(15, 20, "b")]
    : [foot(15, 8, "a"), foot(26, 8, "b", true)];
  return (
    <svg className={`stance-icon ${big ? "big" : ""}`} viewBox="0 0 40 40" aria-hidden>
      {feet}
    </svg>
  );
}
