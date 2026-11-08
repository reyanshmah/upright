"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker, SKELETON_EDGES, type ModelVariant } from "./landmarker";
import { wholeBodyVisible } from "../signal/geometry";
import { ALGO } from "../signal/thresholds";
import type { Landmark, PoseFrame } from "../signal/types";

export type Facing = "environment" | "user";

export interface FrameInfo {
  /** performance.now() in ms */
  t: number;
  main: Landmark[] | null;
  people: number;
  w: number;
  h: number;
  fps: number;
}

export interface Gates {
  fps: number;
  people: number;
  bodyVisible: boolean;
  /** All gates pass: >= 15 fps, exactly one person, whole body in frame. */
  ok: boolean;
}

const NO_GATES: Gates = { fps: 0, people: 0, bodyVisible: false, ok: false };

/**
 * Camera + on-device pose + skeleton overlay + live gates + recording.
 * Shared by the camera check, 3 m measurement and both tests.
 */
export function usePoseCamera(onFrame?: (f: FrameInfo) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);
  const frameTimes = useRef<number[]>([]);
  const recording = useRef<PoseFrame[] | null>(null);
  const fpsLog = useRef<number[]>([]);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [gates, setGates] = useState<Gates>(NO_GATES);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus((s) => (s === "error" ? s : "idle"));
  }, []);

  useEffect(
    () => () => {
      stop();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stop],
  );

  const draw = (people: Landmark[][], w: number, h: number, ok: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    people.forEach((lms, p) => {
      ctx.strokeStyle = p > 0 ? "#ff5a4e" : ok ? "#3ee08f" : "#ffd23f";
      ctx.lineWidth = Math.max(3, w / 200);
      for (const [a, b] of SKELETON_EDGES) {
        if (lms[a].visibility < 0.3 || lms[b].visibility < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(lms[a].x * w, lms[a].y * h);
        ctx.lineTo(lms[b].x * w, lms[b].y * h);
        ctx.stroke();
      }
    });
  };

  const loop = useCallback(() => {
    const video = videoRef.current;
    const lm = landmarkerRef.current;
    if (!video || !lm) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      const t = performance.now(); // timestamps, never frame counts
      const result = lm.detectForVideo(video, t);
      const people = (result.landmarks ?? []) as Landmark[][];
      const w = video.videoWidth;
      const h = video.videoHeight;

      const ft = frameTimes.current;
      ft.push(t);
      while (ft.length && t - ft[0] > 1000) ft.shift();
      const fps = ft.length > 1 ? ((ft.length - 1) * 1000) / (t - ft[0]) : 0;

      const main = people[0] ?? null;
      const bodyVisible = main ? wholeBodyVisible(main, ALGO.minVisibility) : false;
      const ok = fps >= ALGO.minFps && people.length === 1 && bodyVisible;

      if (recording.current) {
        recording.current.push({
          t,
          landmarks: main
            ? main.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0 }))
            : null,
        });
        fpsLog.current.push(fps);
      }

      draw(people, w, h, ok);
      setGates({ fps, people: people.length, bodyVisible, ok });
      onFrameRef.current?.({ t, main, people: people.length, w, h, fps });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(
    async (facing: Facing = "environment", variant: ModelVariant = "full") => {
      setError(null);
      try {
        if (!window.isSecureContext) throw new Error("The camera needs an https:// address.");
        setStatus("loading");
        if (!landmarkerRef.current) landmarkerRef.current = await createPoseLandmarker(variant);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("running");
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
        stop();
      }
    },
    [loop, stop],
  );

  const startRecording = useCallback(() => {
    recording.current = [];
    fpsLog.current = [];
  }, []);

  /** Stops recording; returns frames and the median live fps during it. */
  const stopRecording = useCallback(() => {
    const frames = recording.current ?? [];
    const f = [...fpsLog.current].sort((a, b) => a - b);
    recording.current = null;
    return { frames, fpsMedian: f.length ? f[Math.floor(f.length / 2)] : null };
  }, []);

  const videoSize = () => ({
    w: videoRef.current?.videoWidth ?? 0,
    h: videoRef.current?.videoHeight ?? 0,
  });

  return { videoRef, canvasRef, status, error, gates, start, stop, startRecording, stopRecording, videoSize };
}
