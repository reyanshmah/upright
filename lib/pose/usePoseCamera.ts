"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker, SKELETON_EDGES, type ModelVariant } from "./landmarker";
import { missingParts, type BodyPart } from "../signal/geometry";
import { StableFlag } from "../signal/gate";
import { ALGO, GATES } from "../signal/thresholds";
import type { Landmark, PoseFrame } from "../signal/types";
import { toRecorded } from "../signal/privacy";

export type Facing = "environment" | "user";

export interface ActiveCamera {
  deviceId: string | null;
  label: string;
  /** Zoom applied (e.g. 0.5 for ultra-wide), if the browser exposes zoom. */
  zoom: number | null;
  /** true if we got a wider-than-normal view (zoom < 1 or an ultra-wide lens). */
  wide: boolean;
}

const CAM_KEY = "upright.camera.v1";
const WIDE_LABEL = /ultra|wide|0[.,]5/i;

function rememberCamera(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CAM_KEY, id);
  } catch {
    /* ignore */
  }
}
function rememberedCamera(): string | null {
  try {
    return sessionStorage.getItem(CAM_KEY);
  } catch {
    return null;
  }
}

async function backCameras(): Promise<MediaDeviceInfo[]> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  const back = all.filter((d) => /back|rear|environment|trasera|posterior/i.test(d.label));
  return back.length ? back : all;
}

/** Try to zoom out to the widest view the camera allows. */
async function widen(track: MediaStreamTrack): Promise<number | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caps = (track.getCapabilities?.() ?? {}) as any;
  if (caps.zoom && typeof caps.zoom.min === "number") {
    const min = caps.zoom.min as number;
    if (min < 1) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await track.applyConstraints({ advanced: [{ zoom: min } as any] });
        return min;
      } catch {
        /* fall through */
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((track.getSettings() as any).zoom as number | undefined) ?? null;
  }
  return null;
}

export interface FrameInfo {
  /** performance.now() in ms */
  t: number;
  main: Landmark[] | null;
  people: number;
  w: number;
  h: number;
  fps: number;
  /** Smoothed (hysteresis) gate result for this frame. */
  gatesOk: boolean;
  bodyOk: boolean;
  fpsOk: boolean;
  /** Smoothed: exactly one person in view. */
  personOk: boolean;
}

export interface Gates {
  fps: number;
  people: number;
  bodyVisible: boolean;
  /** Parts out of view right now (for the hint), smoothed with bodyVisible. */
  missing: BodyPart[];
  /** All gates pass: >= 15 fps, exactly one person, whole body in frame. */
  ok: boolean;
}

const NO_GATES: Gates = { fps: 0, people: 0, bodyVisible: false, missing: [], ok: false };

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
  const bodyFlag = useRef(new StableFlag(GATES.body.onMs, GATES.body.offMs));
  const personFlag = useRef(new StableFlag(GATES.onePerson.onMs, GATES.onePerson.offMs));
  const fpsFlag = useRef(new StableFlag(GATES.fps.onMs, GATES.fps.offMs));
  const lastMissing = useRef<BodyPart[]>([]);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [gates, setGates] = useState<Gates>(NO_GATES);
  const [camera, setCamera] = useState<ActiveCamera | null>(null);

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
      const missingNow: BodyPart[] = main ? missingParts(main, ALGO.minVisibility) : ["hips", "knees", "feet"];
      // Smoothed gates: no flicker when a value hovers at its threshold.
      const bodyVisible = bodyFlag.current.update(missingNow.length === 0, t);
      const onePerson = personFlag.current.update(people.length === 1, t);
      const fpsOk = fpsFlag.current.update(fps >= ALGO.minFps, t);
      if (bodyVisible || missingNow.length) lastMissing.current = bodyVisible ? [] : missingNow;
      const ok = fpsOk && onePerson && bodyVisible;

      if (recording.current) {
        recording.current.push({
          t,
          landmarks: toRecorded(main),
        });
        fpsLog.current.push(fps);
      }

      draw(people, w, h, ok);
      setGates({
        fps: fpsOk ? Math.max(fps, ALGO.minFps) : Math.min(fps, ALGO.minFps - 0.1),
        people: onePerson ? 1 : people.length === 1 ? 0 : people.length,
        bodyVisible,
        missing: lastMissing.current,
        ok,
      });
      onFrameRef.current?.({ t, main, people: people.length, w, h, fps, gatesOk: ok, bodyOk: bodyVisible, fpsOk, personOk: onePerson });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const open = async (facing: Facing, deviceId: string | null) => {
    const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const video: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, ...size }
      : { facingMode: facing, ...size };
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  };

  const start = useCallback(
    async (facing: Facing = "environment", variant: ModelVariant = "full", deviceId?: string | null) => {
      setError(null);
      try {
        if (!window.isSecureContext) throw new Error("The camera needs an https:// address.");
        setStatus("loading");
        if (!landmarkerRef.current) landmarkerRef.current = await createPoseLandmarker(variant);
        streamRef.current?.getTracks().forEach((t) => t.stop());

        let id = deviceId ?? (facing === "environment" ? rememberedCamera() : null);
        let stream: MediaStream;
        try {
          stream = await open(facing, id);
        } catch {
          id = null;
          stream = await open(facing, null);
        }
        let track = stream.getVideoTracks()[0];
        let zoom = await widen(track);

        // No zoom-out available: look for a back camera labelled ultra-wide.
        if (facing === "environment" && !deviceId && !(zoom !== null && zoom < 1) && !WIDE_LABEL.test(track.label)) {
          const wideCam = (await backCameras()).find((d) => WIDE_LABEL.test(d.label));
          if (wideCam && wideCam.deviceId !== track.getSettings().deviceId) {
            try {
              const s2 = await open(facing, wideCam.deviceId);
              stream.getTracks().forEach((t) => t.stop());
              stream = s2;
              track = stream.getVideoTracks()[0];
              zoom = await widen(track);
            } catch {
              /* keep the first camera */
            }
          }
        }

        const activeId = track.getSettings().deviceId ?? null;
        if (facing === "environment") rememberCamera(activeId);
        setCamera({
          deviceId: activeId,
          label: track.label,
          zoom,
          wide: (zoom !== null && zoom < 1) || WIDE_LABEL.test(track.label),
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("running");
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
        stop();
      }
    },
    [loop, stop],
  );

  /** Cycle to the next back camera (for phones that list the wide lens separately). */
  const switchCamera = useCallback(async () => {
    const cams = await backCameras();
    if (cams.length < 2) return false;
    const cur = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const i = cams.findIndex((c) => c.deviceId === cur);
    const next = cams[(i + 1) % cams.length];
    await start("environment", "full", next.deviceId);
    return true;
  }, [start]);

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

  return {
    videoRef,
    canvasRef,
    status,
    error,
    gates,
    camera,
    start,
    stop,
    switchCamera,
    startRecording,
    stopRecording,
    videoSize,
  };
}
