"use client";

import { useEffect, useRef, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { AUTO_NEXT_S, gateRows, TestScreen, type TestPhase } from "@/components/TestScreens";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage } from "@/components/CameraStage";
import { CameraControls } from "@/components/CameraControls";
import { getLastCueSource, playCue, playCueAndWait, stopCues, unlockAudio } from "@/lib/voice";
import { getAutoStart } from "@/lib/displayPrefs";
import { phoneMoved, resetPhoneMotion, startPhoneMotion } from "@/lib/motion";
import { buildChairResult, buildTugResult, tugMarkVisible, type RunContext } from "@/lib/analysis";
import { FeatureExtractor, facingCamera } from "@/lib/analysis/features";
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
  walk: AWAY_TINT,
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
  introNote,
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
  /** A reminder shown on the intro screen (e.g. check the 3 m line with the Measure app). */
  introNote?: string;
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
  /** Upright (portrait) picture: the 3 m TUG walk won't fit across it. */
  const [portrait, setPortrait] = useState(false);
  /** The person faces the camera: the TUG walk can't be measured from the front. */
  const [frontal, setFrontal] = useState(false);
  const frontalFlag = useRef(new StableFlag(GATES.seated.onMs, GATES.seated.offMs));
  /** Shown on the position screen, e.g. after the person moved during the instructions. */
  const [notice, setNotice] = useState("");
  /** Settings > Start the test: automatically once every check has held green. */
  const [autoStart, setAutoStartOn] = useState(false);
  const autoStartRef = useRef(false);
  /** Bumped by every start and every interruption, so a stale start can't carry on. */
  const runId = useRef(0);
  /** When the person dropped out of view during the instructions / 3-2-1 (ms), or null. */
  const lostSince = useRef<number | null>(null);

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
      gateLog.current.update("one_person", f.noSecondPerson, f.t);
      gateLog.current.update("fps", f.fpsOk, f.t);
    }

    if (p === "position" && kind === "tug") {
      const tall = f.h > f.w;
      setPortrait((was) => (was === tall ? was : tall));
      const fr = frontalFlag.current.update(!!feat && facingCamera(feat), f.t);
      setFrontal((was) => (was === fr ? was : fr));
    }

    if (p === "position" || p === "instructions" || p === "countdown") {
      const s = seatedFlag.current.update(isSeated, f.t);
      const a = kind === "chair" ? armsFlag.current.update(feat?.wristLow === false, f.t) : true;
      if (p !== "position") {
        gateLog.current.update("seated", s, f.t);
        if (kind === "chair") gateLog.current.update("arms", a, f.t);
      }
      setSeated(s);
      setArmsCrossed(a);
      const ok = f.gatesOk && s && a;
      // During the instructions and 3-2-1, pause the start only when it matters:
      // - the PERSON moved: stood up or uncrossed their arms (posture is measured
      //   on the body itself, so a shaky phone can't fake it): pause at once;
      // - the person is out of view for GATES.interruptLostMs: a hand-held phone
      //   can sway the feet out of the picture for a moment without stopping it;
      // - the PHONE turned more than MOTION.phoneMovedDeg (gyroscope).
      // A frame-rate dip never pauses (the run's median fps is judged at the end).
      if (p !== "position") {
        if (f.bodyOk && f.personOk) lostSince.current = null;
        else lostSince.current ??= f.t;
        const lostLong = lostSince.current !== null && f.t - lostSince.current >= GATES.interruptLostMs;
        if (!s || !a || lostLong) {
          interrupt("person");
          return;
        }
        if (phoneMoved()) {
          interrupt("phone");
          return;
        }
      }
      if (ok) {
        gateSince.current ??= f.t;
        setGateHeldMs(f.t - gateSince.current);
        // Auto-start: begin the moment Start would light up (same hold as the button).
        if (p === "position" && autoStartRef.current && f.t - gateSince.current >= GATES.allGreenHoldMs) void begin();
      } else {
        gateSince.current = null;
        setGateHeldMs(0);
      }
    }

    if (p === "running" && phoneMoved()) {
      // The phone was picked up or turned: the picture no longer matches the run.
      abortRun("phone_moved");
      return;
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

  // Auto-start: open the camera without the "Check position" tap.
  useEffect(() => {
    if (getAutoStart() === "on") openCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start: after a result, move on to the next test; after a failed run, try again.
  const [autoLeft, setAutoLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!autoStartRef.current || (phase !== "done" && phase !== "failed")) {
      setAutoLeft(null);
      return;
    }
    if (phase === "failed") void playCue(lang, "retry", t.autoRetrySpoken);
    let left = AUTO_NEXT_S;
    setAutoLeft(left);
    const id = setInterval(() => {
      left -= 1;
      setAutoLeft(left);
      if (left <= 0) {
        clearInterval(id);
        if (phase === "done") onNext();
        else redo();
      }
    }, 1000);
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
    startPhoneMotion();
    autoStartRef.current = getAutoStart() === "on";
    setAutoStartOn(autoStartRef.current);
    setNotice("");
    fx.current = null; // re-created on first frame with the right size
    gateSince.current = null;
    setGateHeldMs(0);
    // A redo starts from nothing: no stale "seated" / "arms" checks.
    setSeated(false);
    setArmsCrossed(false);
    seatedFlag.current.reset();
    armsFlag.current.reset();
    frontalFlag.current.reset();
    setFrontal(false);
    setPortrait(false);
    setPhase("position");
    void cam.start("environment");
  };

  /** The person (or the phone) moved during the instructions or countdown: back to the check. */
  const interrupt = (why: "person" | "phone") => {
    runId.current++;
    stopCues();
    cam.stopRecording(); // the pre-roll is recorded again on the next start
    phaseRef.current = "position";
    gateSince.current = null;
    setGateHeldMs(0);
    lostSince.current = null;
    setNotice(why === "phone" ? t.pausedPhone : autoStartRef.current ? t.pausedAuto : t.pausedManual);
    // Said out loud too: someone testing alone has walked away from the screen.
    void playCue(lang, "paused", why === "phone" ? t.pausedPhoneSpoken : autoStartRef.current ? t.pausedSpokenAuto : t.pausedSpokenManual);
    setPhase("position");
  };

  const begin = async () => {
    if (phaseRef.current !== "position") return; // already starting (auto-start fires on every frame)
    const id = ++runId.current;
    const live = (want: Phase) => runId.current === id && phaseRef.current === want;
    phaseRef.current = "instructions";
    lostSince.current = null;
    resetPhoneMotion(); // the phone's position now is where it must stay
    unlockAudio(lang);
    gateLog.current.reset();
    sessionFile.current = null;
    cam.startRecording(); // pre-roll: the chair position is learned before Go
    finishing.current = false;
    setNotice("");
    setPhase("instructions");
    await playCueAndWait(lang, kind === "tug" ? "tugInstr" : "chairInstr", kind === "tug" ? t.tugSpoken : t.chairSpoken);
    if (!live("instructions")) return;
    phaseRef.current = "countdown";
    setPhase("countdown");
    const ids = ["three", "two", "one"] as const;
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      void playCue(lang, ids[3 - i], String(i));
      await new Promise((r) => setTimeout(r, 1000));
      if (!live("countdown")) return;
    }
    const go = await playCue(lang, "go", t.cueGo); // time zero
    if (!live("countdown")) return;
    goT.current = go;
    tugDet.current!.setGo(go);
    chairDet.current!.setGo(go);
    setElapsed(0);
    setLiveCount(0);
    setLivePhase("standUp");
    phaseRef.current = "running";
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
  /** Stop and refuse: Stop tapped, the tab was hidden, or the phone was moved mid-test. */
  const abortRun = (reason: "aborted" | "tab_hidden" | "phone_moved") => {
    if (finishing.current) return;
    finishing.current = true;
    runId.current++;
    const { frames, fpsMedian } = cam.stopRecording();
    const { w, h } = cam.videoSize();
    cam.stop();
    stopCues();
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
      // A moved phone is refused like a stop: no number from a picture that shifted.
      aborted: reason === "aborted" || reason === "phone_moved",
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
    setAbortNote(reason === "tab_hidden" ? t.refusalReasons.tab_hidden : reason === "phone_moved" ? t.phoneMovedRun : t.aborted);
    if (reason === "phone_moved") void playCue(lang, "paused", t.phoneMovedRun);
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
          // During the test the box is shorter so the timer and phase line stay on screen.
          maxHeight={phase === "position" ? "55dvh" : "40dvh"}
          overlay={phase === "countdown" ? <div className="big-readout" aria-hidden>{countdown}</div> : null}
        />
      }
      camLoading={cam.status === "loading"}
      camError={cam.error}
      camLine={
        cam.camera ? <CameraControls cam={cam} lang={lang} onChange={() => { fx.current = null; }} /> : null
      }
      rows={rows}
      notice={notice}
      introNote={introNote}
      autoStart={autoStart}
      autoLeft={autoLeft}
      lite={cam.lite}
      tips={kind === "tug" ? [...(frontal ? [t.tipSideView] : []), ...(portrait ? [t.tipTurnSideways] : [])] : []}
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
        backToIntro: () => { runId.current++; stopCues(); cam.stop(); setPhase("intro"); },
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
