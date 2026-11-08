"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";

/** WASM runtime is copied into public/ on `npm install` (scripts/copy-mediapipe.mjs). */
const WASM_URL = "/mediapipe/wasm";

export type ModelVariant = "lite" | "full";
const REMOTE_MODEL: Record<ModelVariant, string> = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
};

/** Prefer the self-hosted model (npm run models); fall back to Google's copy. */
async function modelUrl(variant: ModelVariant): Promise<string> {
  const local = `/models/pose_landmarker_${variant}.task`;
  try {
    const res = await fetch(local, { method: "HEAD" });
    if (res.ok) return local;
  } catch {
    /* fall through */
  }
  return REMOTE_MODEL[variant];
}

/**
 * Create a Pose Landmarker in VIDEO mode. Runs entirely on the device; no
 * video ever leaves the phone. numPoses = 2 so the single-person gate can
 * detect a second person in frame.
 */
export async function createPoseLandmarker(variant: ModelVariant = "full"): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const modelAssetPath = await modelUrl(variant);
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO" as const,
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
  } catch {
    // Some phones lack WebGL2 support for the GPU delegate.
    return await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
  }
}

/** Skeleton edges between MediaPipe Pose landmarks (body only, no face). */
export const SKELETON_EDGES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];
