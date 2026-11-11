import type { Landmark } from "./types";

/** MediaPipe face landmarks (nose, eyes, ears, mouth): indices 0-10. */
export const FACE_LANDMARKS = 11;

const BLANK: Landmark = { x: 0, y: 0, z: 0, visibility: 0 };

/**
 * What gets recorded for a frame. Face landmarks 0-10 are zeroed at the source
 * so no saved stream can identify a face (MASTER.md: never commit face
 * landmarks). The array keeps all 33 slots so landmark indices stay valid.
 * The detectors use shoulders, wrists, hips, knees and ankles only.
 */
export function toRecorded(lms: ReadonlyArray<Partial<Landmark>> | null): Landmark[] | null {
  if (!lms) return null;
  return lms.map((p, i) =>
    i < FACE_LANDMARKS ? { ...BLANK } : { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0, visibility: p.visibility ?? 0 },
  );
}

/** True when every face landmark in the stream is blank (safe to share/commit). */
export function faceRemoved(frames: { landmarks: Landmark[] | null }[]): boolean {
  return frames.every(
    (f) => !f.landmarks || f.landmarks.slice(0, FACE_LANDMARKS).every((p) => p.x === 0 && p.y === 0 && p.z === 0 && p.visibility === 0),
  );
}
