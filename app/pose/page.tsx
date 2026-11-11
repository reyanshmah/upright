"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker, SKELETON_EDGES, type ModelVariant } from "@/lib/pose/landmarker";
import { wholeBodyVisible } from "@/lib/signal/geometry";
import { toRecorded } from "@/lib/signal/privacy";
import { FeatureExtractor, classify } from "@/lib/analysis/features";
import { ChairDetector } from "@/lib/analysis/chair";
import { ALGO } from "@/lib/signal/thresholds";
import type { Landmark, LandmarkStream, PoseFrame } from "@/lib/signal/types";

type Facing = "environment" | "user";

interface Hud {
  fps: number;
  people: number;
  bodyVisible: boolean;
  knee: number | null;
  state: "SEATED" | "STANDING" | "BETWEEN";
  stands: number;
}

const EMPTY_HUD: Hud = { fps: 0, people: 0, bodyVisible: false, knee: null, state: "BETWEEN", stands: 0 };

export default function PosePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const frameTimes = useRef<number[]>([]);
  // Same detectors as the real chair-stand test (lib/analysis/chair.ts).
  const fx = useRef<FeatureExtractor | null>(null);
  const chair = useRef<ChairDetector | null>(null);
  const recording = useRef<PoseFrame[] | null>(null);

  const [status, setStatus] = useState("Tap Start camera. Allow camera access when asked.");
  const [running, setRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [variant, setVariant] = useState<ModelVariant>("full");
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => {
    stop();
    landmarkerRef.current?.close();
  }, [stop]);

  const draw = (people: Landmark[][], w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    people.forEach((lms, p) => {
      ctx.strokeStyle = p === 0 ? "#3ee08f" : "#ff5a4e";
      ctx.lineWidth = Math.max(3, w / 220);
      for (const [a, b] of SKELETON_EDGES) {
        if (lms[a].visibility < 0.3 || lms[b].visibility < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(lms[a].x * w, lms[a].y * h);
        ctx.lineTo(lms[b].x * w, lms[b].y * h);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      for (let i = 11; i < 33; i++) {
        if (lms[i].visibility < 0.3) continue;
        ctx.beginPath();
        ctx.arc(lms[i].x * w, lms[i].y * h, Math.max(3, w / 300), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  const loop = useCallback(() => {
    const video = videoRef.current;
    const lm = landmarkerRef.current;
    if (!video || !lm) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      // Timestamps from performance.now(), never frame counts.
      const t = performance.now();
      const result = lm.detectForVideo(video, t);
      const people = (result.landmarks ?? []) as Landmark[][];
      const w = video.videoWidth;
      const h = video.videoHeight;

      const ft = frameTimes.current;
      ft.push(t);
      while (ft.length && t - ft[0] > 1000) ft.shift();
      const fps = ft.length > 1 ? ((ft.length - 1) * 1000) / (t - ft[0]) : 0;

      let knee: number | null = null;
      let bodyVisible = false;
      const main = people[0];
      if (!fx.current || !chair.current) {
        fx.current = new FeatureExtractor(w, h);
        chair.current = new ChairDetector();
        chair.current.setGo(t); // dev page: the 30 s window starts when counting (re)starts
      }
      const feat = fx.current.push(t, main ?? null);
      const live = chair.current.push(feat, t);
      if (main) bodyVisible = wholeBodyVisible(main, ALGO.minVisibility);
      if (feat && !Number.isNaN(feat.kneeDeg)) knee = feat.kneeDeg;

      recording.current?.push({
        t,
        landmarks: toRecorded(main ?? null),
      });

      draw(people, w, h);
      setHud({
        fps,
        people: people.length,
        bodyVisible,
        knee,
        state: feat ? classify(feat) : "BETWEEN",
        stands: live.count,
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = async () => {
    try {
      if (!window.isSecureContext) {
        setStatus("Camera needs HTTPS. Use the Vercel URL or `npm run dev:https`.");
        return;
      }
      setStatus("Loading pose model (first time can take ~10 s)…");
      if (!landmarkerRef.current) landmarkerRef.current = await createPoseLandmarker(variant);
      setStatus("Starting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      setStatus("Running. Step back until your whole body is in frame.");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setStatus(`Could not start: ${e instanceof Error ? e.message : String(e)}`);
      stop();
    }
  };

  const resetCount = () => {
    fx.current = null; // rebuilt on the next frame, restarts the 30 s window
    chair.current = null;
  };

  const toggleRecording = () => {
    if (!recording.current) {
      recording.current = [];
      setIsRecording(true);
      return;
    }
    const frames = recording.current;
    recording.current = null;
    setIsRecording(false);
    const video = videoRef.current!;
    const data: LandmarkStream = {
      version: 1,
      sessionId: `s-${Date.now().toString(36)}`,
      goCueT: null,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      frames,
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.sessionId}.landmarks.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fpsOk = hud.fps >= ALGO.minFps;

  return (
    <main className="dev">
      <h1>Camera check</h1>
      <p className="muted">{status}</p>

      <div className="row">
        {!running ? (
          <button className="btn btn--primary" onClick={start}>Start camera</button>
        ) : (
          <button className="btn btn--secondary" onClick={stop}>Stop</button>
        )}
        <button
          className="btn btn--secondary"
          disabled={running}
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
        >
          {facing === "environment" ? "Back camera" : "Front camera"}
        </button>
        <button
          className="btn btn--secondary"
          disabled={running || landmarkerRef.current !== null}
          onClick={() => setVariant((v) => (v === "full" ? "lite" : "full"))}
        >
          Model: {variant}
        </button>
      </div>

      <div className="stage">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <div className="hud">
        <div className="stat">FPS<b className={fpsOk ? "ok" : "bad"}>{hud.fps.toFixed(1)}</b></div>
        <div className="stat">People<b className={hud.people === 1 ? "ok" : "bad"}>{hud.people}</b></div>
        <div className="stat">Whole body<b className={hud.bodyVisible ? "ok" : "bad"}>{hud.bodyVisible ? "Yes" : "No"}</b></div>
        <div className="stat">Knee angle<b>{hud.knee === null ? "–" : `${hud.knee.toFixed(0)}°`}</b></div>
        <div className="stat">State<b>{hud.state}</b></div>
        <div className="stat">Stands (test)<b>{hud.stands}</b></div>
      </div>

      <div className="row">
        <button className="btn btn--secondary" disabled={!running} onClick={resetCount}>Reset count</button>
        <button className="btn btn--secondary" disabled={!running} onClick={toggleRecording}>
          {isRecording ? "Stop & download landmarks" : "Record landmark stream"}
        </button>
      </div>

      <p className="disclaimer">
        Home screening aid, not a diagnosis; share results with your doctor. Video is processed on
        this phone only; the landmark download contains body points, not video.
      </p>
    </main>
  );
}
