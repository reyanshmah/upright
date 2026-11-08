"use client";

import { useEffect, useRef, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage, GateBadges } from "@/components/CameraStage";
import { SetupDiagram } from "@/components/Diagram";
import { playCue, playCueAndWait, unlockAudio } from "@/lib/voice";
import { analyzeChairStand, analyzeTug } from "@/lib/analysis";
import { FeatureExtractor } from "@/lib/analysis/features";
import { TugDetector, type TugPhase, type TugPhases } from "@/lib/analysis/tug";
import { ChairDetector } from "@/lib/analysis/chair";
import { StableFlag } from "@/lib/signal/gate";
import type { LandmarkStream, PoseFrame } from "@/lib/signal/types";
import type { ChairResult, TugResult } from "@/lib/session";
import { scoreChairStand, tugAtRisk, type Sex } from "@/lib/signal/thresholds";

type Kind = "tug" | "chair";
type Phase = "intro" | "position" | "instructions" | "countdown" | "running" | "aborted" | "failed" | "done";

const GATE_HOLD_MS = 1500;
const VERY_SLOW_S = 20;

export function TestRunner({
  kind,
  lang,
  age,
  sex,
  onSaved,
  onSkip,
  onNext,
}: {
  kind: Kind;
  lang: Lang;
  age: number;
  sex: Sex;
  onSaved: (r: TugResult | ChairResult) => void;
  onSkip: (reason: string) => void;
  onNext: () => void;
}) {
  const t = STRINGS[lang];
  const n = kind === "tug" ? 1 : 2;
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [gateHeldMs, setGateHeldMs] = useState(0);
  const [seated, setSeated] = useState(false);
  const [armsCrossed, setArmsCrossed] = useState(false);
  const [livePhase, setLivePhase] = useState<TugPhase>("waiting");
  const [liveCount, setLiveCount] = useState(0);
  const [failMsg, setFailMsg] = useState("");
  const [saved, setSaved] = useState<TugResult | ChairResult | null>(null);

  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const goT = useRef<number | null>(null);
  const gateSince = useRef<number | null>(null);
  const frameOk = useRef({ ok: 0, total: 0 });
  const stream = useRef<LandmarkStream | null>(null);
  const fx = useRef<FeatureExtractor | null>(null);
  const tugDet = useRef<TugDetector | null>(null);
  const chairDet = useRef<ChairDetector | null>(null);
  const seatedFlag = useRef(new StableFlag(400, 600));
  const armsFlag = useRef(new StableFlag(400, 600));
  const finishing = useRef(false);

  const newDetectors = (w: number, h: number) => {
    fx.current = new FeatureExtractor(w, h);
    tugDet.current = new TugDetector();
    chairDet.current = new ChairDetector();
    seatedFlag.current.reset();
    armsFlag.current.reset();
  };

  const onFrame = (f: FrameInfo) => {
    const p = phaseRef.current;
    if (!fx.current) newDetectors(f.w, f.h);
    const feat = fx.current!.push(f.t, f.main);

    // Detectors see every frame (before Go they learn where the chair is).
    const tr = tugDet.current!.push(feat, f.t);
    const cr = chairDet.current!.push(feat, f.t);
    const isSeated = kind === "tug" ? tugDet.current!.seatedNow : chairDet.current!.seatedNow;

    if (p === "position" || p === "instructions") {
      const s = seatedFlag.current.update(isSeated, f.t);
      const a = kind === "chair" ? armsFlag.current.update(feat?.wristLow === false, f.t) : true;
      setSeated(s);
      setArmsCrossed(a);
      const ok = f.gatesOk && s && a;
      if (ok) {
        gateSince.current ??= f.t;
        setGateHeldMs(f.t - gateSince.current);
      } else {
        gateSince.current = null;
        setGateHeldMs(0);
      }
    }

    if (p === "countdown" || p === "running") {
      frameOk.current.total++;
      if (f.bodyOk && f.fpsOk) frameOk.current.ok++;
    }

    if (p === "running") {
      if (kind === "tug") {
        setLivePhase(tr.phase);
        if (tr.done) void finish();
        else if (tr.phase === "failed") void finish();
      } else {
        setLiveCount(cr.count);
        if (cr.done) void finish();
      }
    }
  };
  const cam = usePoseCamera(onFrame);

  // Timer display + chair-stand 30 s end even if frames stall.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (goT.current === null) return;
      const now = performance.now();
      setElapsed((now - goT.current) / 1000);
      if (kind === "chair") {
        const cr = chairDet.current!.push(null, now);
        if (cr.done) void finish();
      } else {
        const tr = tugDet.current!.push(null, now);
        if (tr.phase === "failed") void finish();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const openCamera = () => {
    unlockAudio();
    fx.current = null; // re-created on first frame with the right size
    gateSince.current = null;
    setGateHeldMs(0);
    setPhase("position");
    void cam.start("environment");
  };

  const begin = async () => {
    unlockAudio();
    cam.startRecording(); // pre-roll: the chair position is learned before Go
    frameOk.current = { ok: 0, total: 0 };
    finishing.current = false;
    setPhase("instructions");
    await playCueAndWait(lang, kind === "tug" ? "tugInstr" : "chairInstr", kind === "tug" ? t.tugSpoken : t.chairSpoken);
    if (phaseRef.current !== "instructions") return;
    setPhase("countdown");
    const ids = ["three", "two", "one"] as const;
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      void playCue(lang, ids[3 - i], String(i));
      await new Promise((r) => setTimeout(r, 1000));
      if ((phaseRef.current as Phase) !== "countdown") return;
    }
    const go = await playCue(lang, "go", t.cueGo); // time zero
    goT.current = go;
    tugDet.current!.setGo(go);
    chairDet.current!.setGo(go);
    setElapsed(0);
    setLiveCount(0);
    setLivePhase("standUp");
    setPhase("running");
  };

  const finish = async () => {
    if (finishing.current || phaseRef.current !== "running") return;
    finishing.current = true;
    const { frames, fpsMedian } = cam.stopRecording();
    const { w, h } = cam.videoSize();
    stream.current = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}-${kind}`,
      goCueT: goT.current,
      videoWidth: w,
      videoHeight: h,
      frames: frames as PoseFrame[],
    };
    cam.stop();
    const { ok, total } = frameOk.current;
    const gatesPassed = total > 0 && ok / total >= 0.9;
    const camera = cam.camera ? { label: cam.camera.label, zoom: cam.camera.zoom, wide: cam.camera.wide } : undefined;

    if (kind === "tug") {
      // Re-run on the full recording (same code) to get the five phases.
      const a = analyzeTug(stream.current);
      const live = tugDet.current!;
      const totalS = a?.totalS ?? (live.phase === "done" && live.endT && goT.current ? (live.endT - goT.current) / 1000 : null);
      if (totalS === null) {
        setFailMsg(live.phase === "failed" && elapsedRef() > 85 ? t.failTimeout : t.failLost);
        setPhase("failed");
        return;
      }
      const phases: TugPhases | undefined = a?.phases ?? live.phases() ?? undefined;
      void playCue(lang, "done", lang === "es" ? "Listo" : "Done");
      const r: TugResult = {
        totalS: Math.round(totalS * 10) / 10,
        source: "auto",
        ...(phases ? { phases } : {}),
        verySlow: totalS >= VERY_SLOW_S,
        fpsMedian,
        gatesPassed,
        camera,
      };
      setSaved(r);
      onSaved(r);
    } else {
      void playCue(lang, "stop", t.cueStop);
      const a = analyzeChairStand(stream.current);
      const live = chairDet.current!;
      const count = a?.count ?? live.count;
      const armsUsed = a?.armsUsed ?? live.armsUsed;
      if (count === 0 && !armsUsed && !gatesPassed) {
        setFailMsg(t.failNoCount);
        setPhase("failed");
        return;
      }
      const r: ChairResult = {
        count,
        armsUsed,
        halfwayCounted: a?.halfwayCounted ?? live.halfwayCounted,
        source: "auto",
        fpsMedian,
        gatesPassed,
        camera,
      };
      setSaved(r);
      onSaved(r);
    }
    setPhase("done");
  };

  const elapsedRef = () => (goT.current === null ? 0 : (performance.now() - goT.current) / 1000);

  const abort = () => {
    cam.stopRecording();
    cam.stop();
    window.speechSynthesis?.cancel();
    setPhase("aborted");
  };

  const redo = () => {
    goT.current = null;
    setSaved(null);
    setElapsed(0);
    setLiveCount(0);
    setLivePhase("waiting");
    openCamera();
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

  const name = kind === "tug" ? t.tugName : t.chairName;
  const instr = kind === "tug" ? t.tugInstr : t.chairInstr;
  const gateReady = gateHeldMs >= GATE_HOLD_MS;
  const showCam = phase === "position" || phase === "instructions" || phase === "countdown" || phase === "running";

  return (
    <section>
      <p className="eyebrow">{t.testOf(n)}</p>
      <h1>{name}</h1>

      {phase === "intro" && (
        <>
          <p className="muted">{kind === "tug" ? t.tugWhat : t.chairWhat}</p>
          <ol className="steps big-steps">
            {instr.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <h2>{t.placementTitle}</h2>
          <p>{kind === "tug" ? t.tugPlace : t.chairPlace}</p>
          <SetupDiagram kind={kind} />
          <p className="note">{t.spotterTip}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("user skipped")}>{t.skipTest}</button>
            <button className="btn" onClick={openCamera}>{t.checkPosition}</button>
          </div>
        </>
      )}

      {showCam && (
        <>
          {cam.status === "loading" && <p className="muted">{t.loadingCamera}</p>}
          {cam.error && <p className="note bad">{t.cameraError} {cam.error}</p>}
          <CameraStage
            videoRef={cam.videoRef}
            canvasRef={cam.canvasRef}
            overlay={
              phase === "countdown" ? (
                <div className="big-readout">{countdown}</div>
              ) : phase === "running" ? (
                <div className="live-hud">
                  <div className="big-readout">
                    {kind === "chair" ? liveCount : elapsed.toFixed(1)}
                  </div>
                  <div className="live-label">
                    {kind === "chair"
                      ? `${Math.max(0, Math.ceil(30 - elapsed))} s`
                      : t.phaseNames[livePhase]}
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
            <li className={seated ? "ok" : "bad"}>
              <span aria-hidden>{seated ? "✓" : "✗"}</span> {seated ? t.gateSeated : t.gateNotSeated}
            </li>
            {kind === "chair" && (
              <li className={armsCrossed ? "ok" : "bad"}>
                <span aria-hidden>{armsCrossed ? "✓" : "✗"}</span> {armsCrossed ? t.gateArms : t.gateNoArms}
              </li>
            )}
          </ul>
          {!gateReady && cam.status === "running" && <p className="muted">{t.gatesWaiting}</p>}
          <div className="row nav">
            <button className="btn secondary" onClick={() => { cam.stop(); setPhase("intro"); }}>{t.back}</button>
            <button className="btn" disabled={!gateReady} onClick={begin}>{t.startTest}</button>
          </div>
        </>
      )}

      {phase === "instructions" && (
        <>
          <p className="instruction">{t.readingInstr}</p>
          <ol className="steps big-steps">
            {instr.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <button className="btn danger" onClick={abort}>{t.abort}</button>
        </>
      )}

      {phase === "countdown" && (
        <>
          <p className="instruction">{t.countdownReady}</p>
          <button className="btn danger" onClick={abort}>{t.abort}</button>
        </>
      )}

      {phase === "running" && (
        <>
          <p className="instruction">{kind === "tug" ? t.tugRunning : t.chairRunning}</p>
          <button className="btn danger" onClick={abort}>{t.abort}</button>
        </>
      )}

      {phase === "aborted" && (
        <>
          <p className="note">{t.aborted}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("stopped for safety")}>{t.skipTest}</button>
            <button className="btn" onClick={redo}>{t.redo}</button>
          </div>
        </>
      )}

      {phase === "failed" && (
        <>
          <div className="card warn">
            <p className="big">{t.failTitle}</p>
            <p>{failMsg}</p>
          </div>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("could not measure")}>{t.skipTest}</button>
            <button className="btn" onClick={redo}>{t.redo}</button>
          </div>
          {stream.current && <button className="linkish" onClick={downloadStream}>{t.downloadData}</button>}
        </>
      )}

      {phase === "done" && saved && (
        <>
          <p className="note">{t.autoMeasured}</p>
          {"totalS" in saved ? (
            <>
              <div className={`card ${tugAtRisk(saved.totalS) ? "warn" : "okcard"}`}>
                <p className="big">{saved.totalS.toFixed(1)} {t.seconds}</p>
                <p>{tugAtRisk(saved.totalS) ? t.tugRiskYes : t.tugRiskNo}</p>
              </div>
              {saved.phases && <PhaseBars phases={saved.phases} t={t} />}
            </>
          ) : (
            (() => {
              const sc = scoreChairStand(saved.count, saved.armsUsed, age, sex);
              return (
                <div className={`card ${sc.belowAverage ? "warn" : "okcard"}`}>
                  <p className="big">{sc.score}</p>
                  {saved.armsUsed && <p><b>{t.armsUsedResult}</b></p>}
                  {saved.halfwayCounted && <p className="small">{t.halfwayNote}</p>}
                  <p>
                    {sc.norm === null ? t.chairNoNorm : sc.belowAverage ? t.chairBelow(sc.norm) : t.chairOk(sc.norm)}
                  </p>
                </div>
              );
            })()
          )}
          <div className="row nav">
            <button className="btn secondary" onClick={redo}>{t.redo}</button>
            <button className="btn" onClick={onNext}>{t.next}</button>
          </div>
          {stream.current && <button className="linkish" onClick={downloadStream}>{t.downloadData}</button>}
        </>
      )}
    </section>
  );
}

export function PhaseBars({ phases, t }: { phases: TugPhases; t: (typeof STRINGS)["en"] }) {
  const keys = ["standUp", "walkOut", "turn", "walkBack", "sitDown"] as const;
  const total = keys.reduce((a, k) => a + phases[k], 0) || 1;
  return (
    <div className="phases">
      <p className="small"><b>{t.phasesTitle}</b></p>
      <div className="phase-bar">
        {keys.map((k) => (
          <span key={k} className={`ph ph-${k}`} style={{ width: `${(phases[k] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="phase-legend">
        {keys.map((k) => (
          <li key={k}>
            <span className={`dot ph-${k}`} /> {t.phaseShort[k]} <b>{phases[k].toFixed(1)} s</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
