"use client";

import { useEffect, useRef, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { gateRows, TestScreen, type TestPhase } from "@/components/TestScreens";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage } from "@/components/CameraStage";
import { CameraControls } from "@/components/CameraControls";
import { getLastCueSource, playCue, playCueAndWait, unlockAudio } from "@/lib/voice";
import { buildChairResult, buildTugResult, tugMarkVisible, type RunContext } from "@/lib/analysis";
import { FeatureExtractor } from "@/lib/analysis/features";
import { TugDetector, type TugPhase } from "@/lib/analysis/tug";
import { ChairDetector } from "@/lib/analysis/chair";
import { GateLogger, StableFlag } from "@/lib/signal/gate";
import type { LandmarkStream, PoseFrame } from "@/lib/signal/types";
import type { ChairEntry, TugEntry } from "@/lib/session";
import { buildSessionFile, sessionFileName, type SessionFile } from "@/lib/sessionFile";
import { saveRun } from "@/lib/store";
import { GATES, type Sex } from "@/lib/signal/thresholds";

type Kind = "tug" | "chair";

/**
 * Skeleton color while the test runs, so it is clear on screen whether the
 * person has left the chair and whether they are on the way back.
 * Green (default) = at the chair; blue = walking away / turning; purple = coming back.
 */
const AWAY_TINT = "#4da3ff";
const BACK_TINT = "#c084fc";
const TUG_TINT: Partial<Record<TugPhase, string>> = {
  walkOut: AWAY_TINT,
  turn: AWAY_TINT,
  walkBack: BACK_TINT,
  sitDown: BACK_TINT,
};
type Phase = TestPhase;

export function TestRunner({
  kind,
  lang,
  onLang,
  age,
  sex,
  onSaved,
  onSkip,
  onNext,
  onBack,
}: {
  kind: Kind;
  lang: Lang;
  onLang: (l: Lang) => void;
  age: number;
  sex: Sex;
  onSaved: (r: TugEntry | ChairEntry) => void;
  onSkip: (reason: string) => void;
  onNext: () => void;
  /** Back from the intro screen. */
  onBack?: () => void;
}) {
  const t = STRINGS[lang];
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [gateHeldMs, setGateHeldMs] = useState(0);
  const [seated, setSeated] = useState(false);
  const [armsCrossed, setArmsCrossed] = useState(false);
  const [livePhase, setLivePhase] = useState<TugPhase>("waiting");
  const [liveCount, setLiveCount] = useState(0);
  const [failMsg, setFailMsg] = useState("");
  const [saved, setSaved] = useState<TugEntry | ChairEntry | null>(null);
  const [abortNote, setAbortNote] = useState("");

  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const goT = useRef<number | null>(null);
  const gateSince = useRef<number | null>(null);
  const stream = useRef<LandmarkStream | null>(null);
  const fx = useRef<FeatureExtractor | null>(null);
  const tugDet = useRef<TugDetector | null>(null);
  const chairDet = useRef<ChairDetector | null>(null);
  const seatedFlag = useRef(new StableFlag(GATES.seated.onMs, GATES.seated.offMs));
  const armsFlag = useRef(new StableFlag(GATES.arms.onMs, GATES.arms.offMs));
  const gateLog = useRef(new GateLogger());
  const sessionFile = useRef<SessionFile | null>(null);
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

    // Gate log: proof of which gates held, written into the typed result.
    if (p === "instructions" || p === "countdown" || p === "running") {
      gateLog.current.update("body", f.bodyOk, f.t);
      gateLog.current.update("one_person", f.personOk, f.t);
      gateLog.current.update("fps", f.fpsOk, f.t);
    }

    if (p === "position" || p === "instructions") {
      const s = seatedFlag.current.update(isSeated, f.t);
      const a = kind === "chair" ? armsFlag.current.update(feat?.wristLow === false, f.t) : true;
      if (p === "instructions") {
        gateLog.current.update("seated", s, f.t);
        if (kind === "chair") gateLog.current.update("arms", a, f.t);
      }
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

    if (p === "running") {
      if (kind === "tug") {
        cam.setTint(TUG_TINT[tr.phase] ?? null);
        setLivePhase(tr.phase);
        if (tr.done) void finish();
        else if (tr.phase === "failed") void finish();
      } else {
        cam.setTint(chairDet.current!.seatedNow ? null : AWAY_TINT);
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

  // A hidden tab freezes the camera and timers: stop and refuse rather than score it.
  useEffect(() => {
    const onHide = () => {
      const p = phaseRef.current;
      if (document.hidden && (p === "instructions" || p === "countdown" || p === "running")) abortRun("tab_hidden");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCamera = () => {
    unlockAudio(lang);
    fx.current = null; // re-created on first frame with the right size
    gateSince.current = null;
    setGateHeldMs(0);
    // A redo starts from nothing: no stale "seated" / "arms" checks.
    setSeated(false);
    setArmsCrossed(false);
    seatedFlag.current.reset();
    armsFlag.current.reset();
    setPhase("position");
    void cam.start("environment");
  };

  const begin = async () => {
    unlockAudio(lang);
    gateLog.current.reset();
    sessionFile.current = null;
    cam.startRecording(); // pre-roll: the chair position is learned before Go
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
    const st: LandmarkStream = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}-${kind}`,
      goCueT: goT.current,
      videoWidth: w,
      videoHeight: h,
      frames: frames as PoseFrame[],
    };
    stream.current = st;
    cam.stop();
    const camera = cam.camera ? { label: cam.camera.label, zoom: cam.camera.zoom, wide: cam.camera.wide } : undefined;
    const ctx: RunContext = { medianFps: fpsMedian, gateLog: gateLog.current.relativeTo(goT.current ?? 0) };
    // 3 m walk visible? Worked out once here so the session file records it too.
    const markVisible = kind === "tug" ? tugMarkVisible(st) : null;
    if (kind === "tug") ctx.markVisible = markVisible;

    let entry: TugEntry | ChairEntry;
    if (kind === "tug") {
      // Replay the full recording through the same detectors (also yields the five phases).
      const live = tugDet.current!;
      const liveTotal = live.phase === "done" && live.endT && goT.current ? (live.endT - goT.current) / 1000 : null;
      entry = { ...buildTugResult(st, ctx, { totalS: liveTotal, phases: live.phases() }), ...(camera ? { camera } : {}) };
      if (entry.outcome !== "refused") void playCue(lang, "done", lang === "es" ? "Listo" : "Done");
      if (entry.outcome === "refused") {
        setFailMsg(live.failReason === "timeout" ? t.failTimeout : t.refusalReasons[entry.refusalReason ?? "not_visible_at_start_or_end"]);
      }
    } else {
      void playCue(lang, "stop", t.cueStop);
      const live = chairDet.current!;
      entry = {
        ...buildChairResult(st, ctx, { age, sex }, { count: live.count, armsUsed: live.armsUsed, halfwayCounted: live.halfwayCounted }),
        ...(camera ? { camera } : {}),
      };
      if (entry.outcome === "refused") {
        setFailMsg(t.refusalReasons[(entry.refusalReason ?? "not_visible_at_start_or_end") as keyof typeof t.refusalReasons] ?? t.failNoCount);
      }
    }

    sessionFile.current = buildSessionFile({
      kind,
      stream: st,
      result: entry,
      age,
      sex,
      cueSource: getLastCueSource(),
      markVisible,
    });
    void saveRun({ id: st.sessionId, kind, result: entry }); // local copy before the results screen
    setSaved(entry);
    onSaved(entry);
    setPhase(entry.outcome === "refused" ? "failed" : "done");
  };

  /** Stop the test, show no number, and log the refusal. */
  const abortRun = (reason: "aborted" | "tab_hidden") => {
    if (finishing.current) return;
    finishing.current = true;
    const { frames, fpsMedian } = cam.stopRecording();
    const { w, h } = cam.videoSize();
    cam.stop();
    window.speechSynthesis?.cancel();
    const st: LandmarkStream = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}-${kind}`,
      goCueT: goT.current,
      videoWidth: w,
      videoHeight: h,
      frames: frames as PoseFrame[],
    };
    const ctx: RunContext = {
      medianFps: fpsMedian,
      gateLog: gateLog.current.relativeTo(goT.current ?? 0),
      aborted: reason === "aborted",
      tabHidden: reason === "tab_hidden",
    };
    const result = kind === "tug" ? buildTugResult(st, ctx) : buildChairResult(st, ctx, { age, sex });
    void saveRun({ id: st.sessionId, kind, result });
    // Keep what was recorded so it can be downloaded and replayed.
    if (frames.length) {
      stream.current = st;
      sessionFile.current = buildSessionFile({
        kind,
        stream: st,
        result,
        age,
        sex,
        cueSource: getLastCueSource(),
        markVisible: kind === "tug" ? tugMarkVisible(st) : null,
      });
    }
    setAbortNote(reason === "tab_hidden" ? t.refusalReasons.tab_hidden : t.aborted);
    setPhase("aborted");
  };
  const abort = () => abortRun("aborted");

  const redo = () => {
    goT.current = null;
    finishing.current = false;
    sessionFile.current = null;
    setSaved(null);
    setElapsed(0);
    setLiveCount(0);
    setLivePhase("waiting");
    openCamera();
  };

  const downloadStream = () => {
    const f = sessionFile.current;
    if (!f) return;
    const blob = new Blob([JSON.stringify(f)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = sessionFileName(f);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const gateReady = gateHeldMs >= GATES.allGreenHoldMs;
  const rows = gateRows(kind, cam.gates, seated, armsCrossed, t);

  return (
    <TestScreen
      kind={kind}
      lang={lang}
      onLang={onLang}
      phase={phase}
      stage={
        <CameraStage
          videoRef={cam.videoRef}
          canvasRef={cam.canvasRef}
          mirror={cam.facing === "user"}
          overlay={phase === "countdown" ? <div className="big-readout" aria-hidden>{countdown}</div> : null}
        />
      }
      camLoading={cam.status === "loading"}
      camError={cam.error}
      camLine={
        cam.camera ? <CameraControls cam={cam} lang={lang} onChange={() => { fx.current = null; }} /> : null
      }
      rows={rows}
      allOk={rows.every((r) => r.ok)}
      gateReady={gateReady}
      countdown={countdown}
      elapsed={elapsed}
      livePhaseLabel={t.phaseNames[livePhase]}
      liveCount={liveCount}
      failMsg={failMsg}
      abortNote={abortNote}
      saved={saved}
      age={age}
      sex={sex}
      canDownload={!!sessionFile.current}
      on={{
        check: openCamera,
        skip: onSkip,
        backToIntro: () => { cam.stop(); setPhase("intro"); },
        begin: () => void begin(),
        abort,
        redo,
        next: onNext,
        back: onBack,
        download: downloadStream,
      }}
    />
  );
}
