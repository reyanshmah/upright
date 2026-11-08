"use client";

import { useRef, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage, GateBadges } from "@/components/CameraStage";
import { playCue, playCueAndWait, unlockAudio, type CueId } from "@/lib/voice";
import { BalanceDetector, FrontFeatures, HOLD_S, tandemHeld10, type Stage } from "@/lib/analysis/balance";
import { angleDeg } from "@/lib/signal/geometry";
import { StableFlag } from "@/lib/signal/gate";
import { LM, type LandmarkStream, type PoseFrame } from "@/lib/signal/types";
import type { BalanceResult } from "@/lib/session";

type Phase = "intro" | "position" | "running" | "aborted" | "failed" | "done";
type StageView = "instr" | "wait" | "hold" | "held" | "moved";

const GATE_HOLD_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BalanceRunner({
  lang,
  onSaved,
  onSkip,
  onNext,
}: {
  lang: Lang;
  onSaved: (r: BalanceResult) => void;
  onSkip: (reason: string) => void;
  onNext: () => void;
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
  const standFlag = useRef(new StableFlag(400, 600));
  const gateSince = useRef<number | null>(null);
  const frameOk = useRef({ ok: 0, total: 0 });
  const aborted = useRef(false);
  const stream = useRef<LandmarkStream | null>(null);

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
        up = kl > 150 && kr > 150;
      }
      const s = standFlag.current.update(up, f.t);
      setStanding(s);
      if (f.gatesOk && s) {
        gateSince.current ??= f.t;
        setGateHeldMs(f.t - gateSince.current);
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
    unlockAudio();
    fx.current = null;
    gateSince.current = null;
    setGateHeldMs(0);
    setPhase("position");
    void cam.start("environment");
  };

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
    unlockAudio();
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
    window.speechSynthesis?.cancel();
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

  const gateReady = gateHeldMs >= GATE_HOLD_MS;
  const remaining = Math.max(0, Math.ceil(HOLD_S - holdS));

  return (
    <section>
      <p className="eyebrow">{t.testOf(3)}</p>
      <h1>{t.balName}</h1>

      {phase === "intro" && (
        <>
          <p className="muted">{t.balWhat}</p>
          <ol className="steps big-steps">
            {([1, 2, 3, 4] as Stage[]).map((s) => (
              <li key={s}>
                <StanceIcon stage={s} /> {t.balStages[s]}
              </li>
            ))}
          </ol>
          <ul className="small-list">
            {t.balRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <h2>{t.placementTitle}</h2>
          <p>{t.balPlace}</p>
          <p className="note">{t.spotterTip}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("user skipped")}>{t.skipTest}</button>
            <button className="btn" onClick={openCamera}>{t.checkPosition}</button>
          </div>
        </>
      )}

      {(phase === "position" || phase === "running") && (
        <>
          {cam.status === "loading" && <p className="muted">{t.loadingCamera}</p>}
          {cam.error && <p className="note bad">{t.cameraError} {cam.error}</p>}
          <CameraStage
            videoRef={cam.videoRef}
            canvasRef={cam.canvasRef}
            overlay={
              phase === "running" ? (
                <div className="live-hud">
                  {view === "hold" && <div className="big-readout">{remaining}</div>}
                  {view === "held" && <div className="big-readout ok">✓</div>}
                  <div className="live-label">
                    {t.balStageLabel(stage)} ·{" "}
                    {view === "hold" ? t.balHoldLabel : view === "wait" ? t.balGetInto : view === "held" ? t.balGood : view === "moved" ? t.balFoot : ""}
                  </div>
                </div>
              ) : null
            }
          />
        </>
      )}

      {phase === "position" && (
        <>
          {cam.camera && (
            <p className="camline">
              {cam.camera.wide ? t.camWide : t.camNormal}{" "}
              <button className="linkish" onClick={() => { fx.current = null; void cam.switchCamera(); }}>{t.camSwitch}</button>
            </p>
          )}
          <GateBadges gates={cam.gates} t={t} />
          <ul className="gates">
            <li className={standing ? "ok" : "bad"}>
              <span aria-hidden>{standing ? "✓" : "✗"}</span> {standing ? t.gateStanding : t.gateNotStanding}
            </li>
          </ul>
          {!gateReady && cam.status === "running" && <p className="muted">{t.gatesWaiting}</p>}
          <div className="row nav">
            <button className="btn secondary" onClick={() => { cam.stop(); setPhase("intro"); }}>{t.back}</button>
            <button className="btn" disabled={!gateReady} onClick={() => void run()}>{t.startTest}</button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          <div className="stance-card">
            <StanceIcon stage={stage} big />
            <p className="instruction">{t.balStages[stage]}</p>
          </div>
          <button className="btn danger" onClick={abort}>{t.abort}</button>
        </>
      )}

      {phase === "aborted" && (
        <>
          <p className="note">{t.aborted}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("stopped for safety")}>{t.skipTest}</button>
            <button className="btn" onClick={openCamera}>{t.redo}</button>
          </div>
        </>
      )}

      {phase === "failed" && (
        <>
          <div className="card warn">
            <p className="big">{t.failTitle}</p>
            <p>{t.balLost}</p>
          </div>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("could not measure")}>{t.skipTest}</button>
            <button className="btn" onClick={openCamera}>{t.redo}</button>
          </div>
          {stream.current && <button className="linkish" onClick={downloadStream}>{t.downloadData}</button>}
        </>
      )}

      {phase === "done" && saved && (
        <>
          <p className="note">{t.autoMeasured}</p>
          <div className={`card ${saved.tandemHeld10 ? "okcard" : "warn"}`}>
            <p className="big">{saved.tandemHeld10 ? t.balTandemOk : t.balTandemRisk}</p>
          </div>
          <BalanceTable result={saved} t={t} />
          <div className="row nav">
            <button className="btn secondary" onClick={openCamera}>{t.redo}</button>
            <button className="btn" onClick={onNext}>{t.seeResults}</button>
          </div>
          {stream.current && <button className="linkish" onClick={downloadStream}>{t.downloadData}</button>}
        </>
      )}
    </section>
  );
}

export function BalanceTable({ result, t }: { result: BalanceResult; t: (typeof STRINGS)["en"] }) {
  return (
    <ul className="summary">
      {([1, 2, 3, 4] as Stage[]).map((s) => {
        const r = result.stages.find((x) => x.stage === s);
        return (
          <li key={s}>
            <span>
              <StanceIcon stage={s} /> {t.balStageLabel(s)}
            </span>
            <span>
              {r ? (
                <>
                  {t.balHeld(r.heldS.toFixed(1))}{" "}
                  <span className={`chip ${r.completed ? "ok" : "risk"}`}>{r.completed ? "✓" : "✗"}</span>
                </>
              ) : (
                <span className="chip na">—</span>
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
