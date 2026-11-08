"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRINGS, type Lang } from "@/lib/i18n";
import { loadSession, updateSession, type SessionState } from "@/lib/session";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage } from "@/components/CameraStage";
import { SetupDiagram } from "@/components/Diagram";
import {
  distanceM,
  footX,
  measurable,
  median,
  pixelsPerMeter,
  TARGET_M,
  TOLERANCE_M,
  cmToFtIn,
} from "@/lib/measure";
import { playCue, unlockAudio } from "@/lib/voice";

type Step = "safety" | "method" | "tape" | "camera";

export default function Setup() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<Step>("safety");
  const [checks, setChecks] = useState([false, false, false, false, false]);

  useEffect(() => {
    setSession(loadSession());
    setLoaded(true);
  }, []);

  if (!loaded) return <main />;
  if (!session) {
    return (
      <main>
        <h1>Upright</h1>
        <p>Start with the screening questions first.</p>
        <Link className="btn" href="/start">Start</Link>
      </main>
    );
  }

  const lang = session.lang;
  const t = STRINGS[lang];
  const items = [t.safetyChair, t.safetyFloor, t.safetyShoes, t.safetyHelper, t.safetyStop];

  const finish = (method: "camera" | "tape", measured: number | null) => {
    updateSession({ setup: { safetyConfirmed: true, lineMethod: method, cameraMeasuredM: measured } });
    router.push("/test/tug");
  };

  return (
    <main lang={lang}>
      {step === "safety" && (
        <section>
          <h1>{t.safetyTitle}</h1>
          <p className="muted">{t.safetySub}</p>
          <ul className="checklist">
            {items.map((text, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span>{text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!checks.every(Boolean) && <p className="muted">{t.safetyAll}</p>}
          <div className="row nav">
            <Link className="btn secondary" href="/start">{t.back}</Link>
            <button className="btn" disabled={!checks.every(Boolean)} onClick={() => setStep("method")}>
              {t.next}
            </button>
          </div>
        </section>
      )}

      {step === "method" && (
        <section>
          <h1>{t.measureTitle}</h1>
          <p>{t.measureSub}</p>
          <SetupDiagram kind="measure" />
          <div className="choices">
            <button className="choice" onClick={() => { unlockAudio(); setStep("camera"); }}>
              📷 {t.measureCamera}
            </button>
            <button className="choice" onClick={() => setStep("tape")}>
              📏 {t.measureTape}
            </button>
          </div>
          <div className="row nav">
            <button className="btn secondary" onClick={() => setStep("safety")}>{t.back}</button>
          </div>
        </section>
      )}

      {step === "tape" && (
        <section>
          <h1>{t.tapeTitle}</h1>
          <p>{t.tapeBody}</p>
          <SetupDiagram kind="tug" />
          <div className="row nav">
            <button className="btn secondary" onClick={() => setStep("method")}>{t.back}</button>
            <button className="btn" onClick={() => finish("tape", null)}>{t.tapeDone}</button>
          </div>
        </section>
      )}

      {step === "camera" && (
        <CameraMeasure
          lang={lang}
          heightCm={session.profile.heightCm}
          onBack={() => setStep("method")}
          onDone={(m) => finish("camera", m)}
        />
      )}

      <p className="disclaimer">{t.disclaimer}</p>
    </main>
  );
}

type MPhase = "hold" | "walk";

function CameraMeasure({
  lang,
  heightCm,
  onBack,
  onDone,
}: {
  lang: Lang;
  heightCm: number | undefined;
  onBack: () => void;
  onDone: (measuredM: number) => void;
}) {
  const t = STRINGS[lang];
  const [phase, setPhase] = useState<MPhase>("hold");
  const [dist, setDist] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const holdSamples = useRef<{ ppm: number; x: number; t: number }[]>([]);
  const calib = useRef<{ ppm: number; startX: number } | null>(null);
  const spokeStop = useRef(false);
  const phaseRef = useRef<MPhase>("hold");
  phaseRef.current = phase;

  const onFrame = (f: FrameInfo) => {
    if (!heightCm || !f.main) {
      setVisible(false);
      return;
    }
    const ok = f.people === 1 && measurable(f.main);
    setVisible(ok);
    if (!ok) {
      if (phaseRef.current === "hold") holdSamples.current = [];
      return;
    }
    const x = footX(f.main, f.w);

    if (phaseRef.current === "hold") {
      const s = holdSamples.current;
      s.push({ ppm: pixelsPerMeter(f.main, f.w, f.h, heightCm), x, t: f.t });
      while (s.length && f.t - s[0].t > 1500) s.shift();
      const xs = s.map((p) => p.x);
      const spread = Math.max(...xs) - Math.min(...xs);
      // Still for ~1.5 s: foot moved less than 2% of the frame width.
      if (s.length >= 15 && f.t - s[0].t > 1200 && spread < 0.02 * f.w) {
        calib.current = { ppm: median(s.map((p) => p.ppm)), startX: median(xs) };
        spokeStop.current = false;
        setPhase("walk");
      }
      return;
    }

    if (calib.current) {
      const d = distanceM(calib.current.startX, x, calib.current.ppm);
      setDist(d);
      if (Math.abs(d - TARGET_M) <= TOLERANCE_M && !spokeStop.current) {
        spokeStop.current = true;
        void playCue(lang, "measureStop", t.cueStop);
      }
      if (d < TARGET_M - 0.3) spokeStop.current = false;
    }
  };

  const cam = usePoseCamera(onFrame);

  if (!heightCm) {
    return (
      <section>
        <p className="note bad">{t.measureNeedHeight}</p>
        <button className="btn secondary" onClick={onBack}>{t.back}</button>
      </section>
    );
  }

  const atTarget = dist !== null && Math.abs(dist - TARGET_M) <= TOLERANCE_M;
  const tooFar = dist !== null && dist > TARGET_M + TOLERANCE_M;
  const pct = dist === null ? 0 : Math.min(100, (dist / TARGET_M) * 100);

  return (
    <section>
      <h1>{t.measureTitle}</h1>
      <p className="note">{t.measurePlace}</p>

      {cam.status !== "running" && (
        <div className="row">
          <button className="btn" onClick={() => cam.start("environment")} disabled={cam.status === "loading"}>
            {cam.status === "loading" ? t.loadingCamera : t.startCamera}
          </button>
        </div>
      )}
      {cam.error && <p className="note bad">{t.cameraError} {cam.error}</p>}

      <CameraStage
        videoRef={cam.videoRef}
        canvasRef={cam.canvasRef}
        overlay={
          cam.status === "running" && phase === "walk" && dist !== null ? (
            <div className={`big-readout ${atTarget ? "ok" : tooFar ? "bad" : ""}`}>
              {dist.toFixed(2)} m
            </div>
          ) : null
        }
      />

      {cam.status === "running" && (
        <>
          {!visible && <p className="note bad">{t.measureNeedBody}</p>}
          {phase === "hold" && (
            <p className="instruction">{t.measureStep1} {visible && <b>{t.measureHold}</b>}</p>
          )}
          {phase === "walk" && (
            <>
              <p className="instruction">{t.measureStep2}</p>
              <div className="meter" aria-label={t.measureDistance}>
                <div className={`meter-fill ${atTarget ? "ok" : tooFar ? "bad" : ""}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="meter-label">
                {t.measureDistance}: <b>{dist === null ? "–" : `${dist.toFixed(2)} m (${cmToFtIn(dist * 100)})`}</b>
              </p>
              {atTarget && (
                <div className="card okcard">
                  <p className="big">{t.measureStopNow}</p>
                  <p>{t.measureMark}</p>
                </div>
              )}
              {tooFar && <p className="note">{t.measureTooFar}</p>}
              {!atTarget && !tooFar && <p className="muted">{t.measureKeepGoing}</p>}
            </>
          )}
        </>
      )}

      <p className="muted small">{t.measureAccuracy}</p>

      <div className="row nav">
        <button
          className="btn secondary"
          onClick={() => {
            cam.stop();
            onBack();
          }}
        >
          {t.back}
        </button>
        {phase === "walk" && (
          <button
            className="btn secondary"
            onClick={() => {
              holdSamples.current = [];
              calib.current = null;
              setDist(null);
              setPhase("hold");
            }}
          >
            {t.measureAgain}
          </button>
        )}
        <button
          className="btn"
          disabled={!atTarget}
          onClick={() => {
            cam.stop();
            onDone(dist!);
          }}
        >
          {t.measureMarked}
        </button>
      </div>
    </section>
  );
}
