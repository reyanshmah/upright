"use client";

import { useEffect, useRef, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage, GateBadges } from "@/components/CameraStage";
import { SetupDiagram } from "@/components/Diagram";
import { playCue, unlockAudio } from "@/lib/voice";
import { analyzeChairStand, analyzeTug } from "@/lib/analysis";
import type { LandmarkStream, PoseFrame } from "@/lib/signal/types";
import type { ChairResult, TugResult } from "@/lib/session";
import { scoreChairStand, tugAtRisk, ALGO, type Sex } from "@/lib/signal/thresholds";

type Kind = "tug" | "chair";
type Phase = "intro" | "position" | "countdown" | "running" | "aborted" | "entry" | "done";

const TUG_MAX_S = 120;
const GATE_HOLD_MS = 2000;

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
  const [noCam, setNoCam] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [gateHeldMs, setGateHeldMs] = useState(0);
  const goT = useRef<number | null>(null);
  const gateSince = useRef<number | null>(null);
  const frameOk = useRef({ ok: 0, total: 0 });
  const stream = useRef<LandmarkStream | null>(null);
  const fpsMedian = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;

  // entry fields
  const [manualS, setManualS] = useState<number | null>(null);
  const [timeText, setTimeText] = useState("");
  const [obs, setObs] = useState<string[]>([]);
  const [unsteady, setUnsteady] = useState<boolean | null>(null);
  const [countText, setCountText] = useState("");
  const [arms, setArms] = useState<boolean | null>(null);
  const [auto, setAuto] = useState<{ totalS?: number; count?: number; armsUsed?: boolean } | null>(null);
  const [saved, setSaved] = useState<TugResult | ChairResult | null>(null);

  const onFrame = (f: FrameInfo) => {
    const p = phaseRef.current;
    // Before "Go": all gates, including one person in view.
    // During the test the spotter walks beside them, so only body + fps count.
    const ok = p === "position" ? f.gatesOk : f.bodyOk && f.fpsOk;
    if (p === "position") {
      if (ok) {
        gateSince.current ??= f.t;
        setGateHeldMs(f.t - gateSince.current);
      } else {
        gateSince.current = null;
        setGateHeldMs(0);
      }
    }
    if (p === "running" || p === "countdown") {
      frameOk.current.total++;
      if (ok) frameOk.current.ok++;
    }
  };
  const cam = usePoseCamera(onFrame);

  // running timer
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (goT.current === null) return;
      const s = (performance.now() - goT.current) / 1000;
      setElapsed(s);
      if (kind === "chair" && s >= ALGO.chairStandWindowS) finishRun();
      if (kind === "tug" && s >= TUG_MAX_S) finishRun();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const beginCountdown = async () => {
    unlockAudio();
    frameOk.current = { ok: 0, total: 0 };
    cam.startRecording(); // pre-roll before "go"
    setPhase("countdown");
    const ids = ["three", "two", "one"] as const;
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      void playCue(lang, ids[3 - i], String(i));
      await new Promise((r) => setTimeout(r, 1000));
      if (phaseRef.current !== "countdown") return;
    }
    goT.current = await playCue(lang, "go", t.cueGo); // time zero
    setElapsed(0);
    setPhase("running");
  };

  const finishRun = () => {
    if (phaseRef.current !== "running" || goT.current === null) return;
    const tapS = (performance.now() - goT.current) / 1000;
    if (kind === "chair") void playCue(lang, "stop", t.cueStop);
    const { frames, fpsMedian: fm } = cam.stopRecording();
    fpsMedian.current = fm;
    const { w, h } = cam.videoSize();
    stream.current = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}-${kind}`,
      goCueT: goT.current,
      videoWidth: w,
      videoHeight: h,
      frames: frames as PoseFrame[],
    };
    if (kind === "tug") {
      const a = analyzeTug(stream.current);
      setAuto(a ? { totalS: a.totalS } : null);
      const ms = Math.round(tapS * 10) / 10;
      setManualS(ms);
      setTimeText(String(a ? a.totalS.toFixed(1) : ms));
    } else {
      const a = analyzeChairStand(stream.current);
      setAuto(a ? { count: a.count, armsUsed: a.armsUsed } : null);
      if (a) {
        setCountText(String(a.count));
        setArms(a.armsUsed);
      }
    }
    cam.stop();
    setPhase("entry");
  };

  const abort = () => {
    cam.stopRecording();
    cam.stop();
    window.speechSynthesis?.cancel();
    setPhase("aborted");
  };

  const reset = () => {
    goT.current = null;
    gateSince.current = null;
    setGateHeldMs(0);
    setElapsed(0);
    setAuto(null);
    setManualS(null);
    setTimeText("");
    setObs([]);
    setUnsteady(null);
    setCountText("");
    setArms(null);
    setSaved(null);
    setNoCam(false);
    setPhase("position");
    void cam.start("environment");
  };

  const gatesPassed = () => {
    const { ok, total } = frameOk.current;
    return total > 0 && ok / total >= 0.9;
  };

  const camInfo = () =>
    noCam || !cam.camera ? undefined : { label: cam.camera.label, zoom: cam.camera.zoom, wide: cam.camera.wide };

  const save = () => {
    if (kind === "tug") {
      const r: TugResult = {
        totalS: Number(timeText),
        source: auto?.totalS !== undefined ? "auto" : "manual",
        manualS,
        observations: obs,
        lookedUnsteady: !!unsteady,
        fpsMedian: fpsMedian.current,
        gatesPassed: gatesPassed(),
        camera: camInfo(),
      };
      setSaved(r);
      onSaved(r);
    } else {
      const r: ChairResult = {
        count: Number(countText),
        armsUsed: !!arms,
        source: auto?.count !== undefined ? "auto" : "manual",
        manualCount: auto ? null : Number(countText),
        fpsMedian: fpsMedian.current,
        gatesPassed: gatesPassed(),
        camera: camInfo(),
      };
      setSaved(r);
      onSaved(r);
    }
    setPhase("done");
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

  const timeValid = timeText !== "" && Number(timeText) > 0 && Number(timeText) < 300;
  const countValid = countText !== "" && Number.isInteger(Number(countText)) && Number(countText) >= 0 && Number(countText) <= 40;
  const entryDone = kind === "tug" ? timeValid && unsteady !== null : countValid && arms !== null;

  const name = kind === "tug" ? t.tugName : t.chairName;
  const instr = kind === "tug" ? t.tugInstr : t.chairInstr;
  const gateReady = gateHeldMs >= GATE_HOLD_MS;

  return (
    <section>
      <p className="eyebrow">{t.testOf(n)}</p>
      <h1>{name}</h1>

      {phase === "intro" && (
        <>
          <p className="muted">{kind === "tug" ? t.tugWhat : t.chairWhat}</p>
          <ol className="steps">
            {instr.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <h2>{t.placementTitle}</h2>
          <p>{kind === "tug" ? t.tugPlace : t.chairPlace}</p>
          <SetupDiagram kind={kind} />
          <p className="note">{t.spotterTip}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("user skipped")}>{t.skipTest}</button>
            <button
              className="btn"
              onClick={() => {
                unlockAudio();
                setPhase("position");
                void cam.start("environment");
              }}
            >
              {t.checkPosition}
            </button>
          </div>
        </>
      )}

      {(phase === "position" || phase === "countdown" || phase === "running") && (
        <>
          {cam.status === "loading" && <p className="muted">{t.loadingCamera}</p>}
          {cam.error && !noCam && <p className="note bad">{t.cameraError} {cam.error}</p>}
          <CameraStage
            videoRef={cam.videoRef}
            canvasRef={cam.canvasRef}
            overlay={
              phase === "countdown" ? (
                <div className="big-readout">{countdown}</div>
              ) : phase === "running" ? (
                <div className="big-readout">
                  {kind === "chair"
                    ? Math.max(0, Math.ceil(ALGO.chairStandWindowS - elapsed))
                    : elapsed.toFixed(1)}
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
              <button className="linkish" onClick={() => void cam.switchCamera()}>{t.camSwitch}</button>
            </p>
          )}
          <GateBadges gates={cam.gates} t={t} />
          {!gateReady && cam.status === "running" && <p className="muted">{t.gatesWaiting}</p>}
          <div className="row nav">
            <button className="btn secondary" onClick={() => { cam.stop(); setPhase("intro"); }}>{t.back}</button>
            <button className="btn" disabled={!gateReady} onClick={beginCountdown}>{t.startTest}</button>
          </div>
          <button className="linkish" onClick={() => { setNoCam(true); cam.stop(); void beginCountdown(); }}>
            {t.noCamera}
          </button>
        </>
      )}

      {phase === "countdown" && <p className="instruction">{t.countdownReady}</p>}

      {phase === "running" && (
        <>
          <p className="instruction">{kind === "tug" ? t.tugRunning : t.chairRunning}</p>
          {kind === "tug" && (
            <button className="btn huge" onClick={finishRun}>{t.tugSatDown}</button>
          )}
          <button className="btn danger" onClick={abort}>{t.abort}</button>
        </>
      )}

      {phase === "aborted" && (
        <>
          <p className="note">{t.aborted}</p>
          <div className="row nav">
            <button className="btn secondary" onClick={() => onSkip("stopped for safety")}>{t.skipTest}</button>
            <button className="btn" onClick={reset}>{t.redo}</button>
          </div>
        </>
      )}

      {phase === "entry" && (
        <>
          <p className="note">{auto ? t.autoMeasured : t.autoNone}</p>
          {kind === "tug" ? (
            <>
              <label className="field">
                <span>{t.tugTimeLabel}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                />
              </label>
              {manualS !== null && <p className="muted small">{t.tugYourTap} {manualS.toFixed(1)} s</p>}
              <div className="field">
                <span>{t.tugObsTitle}</span>
                <ul className="checklist compact">
                  {Object.entries(t.tugObs).map(([k, label]) => (
                    <li key={k}>
                      <label>
                        <input
                          type="checkbox"
                          checked={obs.includes(k)}
                          onChange={(e) =>
                            setObs((o) => (e.target.checked ? [...o, k] : o.filter((x) => x !== k)))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="question">
                <p>{t.tugUnsteadyQ}</p>
                <div className="choices">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" className={`choice ${unsteady === v ? "selected" : ""}`} onClick={() => setUnsteady(v)}>
                      {v ? t.yes : t.no}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span>{t.chairCountLabel}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={countText}
                  onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </label>
              <p className="muted small">{t.chairHalfway}</p>
              <div className="question">
                <p>{t.chairArmsQ}</p>
                <div className="choices">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" className={`choice ${arms === v ? "selected" : ""}`} onClick={() => setArms(v)}>
                      {v ? t.yes : t.no}
                    </button>
                  ))}
                </div>
                {arms && <p className="note">{t.chairArmsNote}</p>}
              </div>
            </>
          )}
          <div className="row nav">
            <button className="btn secondary" onClick={reset}>{t.redo}</button>
            <button className="btn" disabled={!entryDone} onClick={save}>{t.saveResult}</button>
          </div>
        </>
      )}

      {phase === "done" && saved && (
        <>
          {"totalS" in saved ? (
            <div className={`card ${tugAtRisk(saved.totalS) ? "warn" : "okcard"}`}>
              <p className="big">{saved.totalS.toFixed(1)} {t.seconds}</p>
              <p>{tugAtRisk(saved.totalS) ? t.tugRiskYes : t.tugRiskNo}</p>
            </div>
          ) : (
            (() => {
              const sc = scoreChairStand(saved.count, saved.armsUsed, age, sex);
              return (
                <div className={`card ${sc.belowAverage ? "warn" : "okcard"}`}>
                  <p className="big">{sc.score}</p>
                  <p>
                    {sc.norm === null
                      ? t.chairNoNorm
                      : sc.belowAverage
                        ? t.chairBelow(sc.norm)
                        : t.chairOk(sc.norm)}
                  </p>
                </div>
              );
            })()
          )}
          <div className="row nav">
            <button className="btn secondary" onClick={reset}>{t.redo}</button>
            <button className="btn" onClick={onNext}>{kind === "tug" ? t.next : t.seeResults}</button>
          </div>
          {stream.current && (
            <button className="linkish" onClick={downloadStream}>{t.downloadData}</button>
          )}
        </>
      )}
    </section>
  );
}
