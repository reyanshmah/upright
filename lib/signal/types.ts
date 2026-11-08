/** One MediaPipe landmark in normalized image coordinates. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** One frame of a saved landmark stream. 33 landmarks (MediaPipe Pose). */
export interface PoseFrame {
  /** Milliseconds from performance.now(), never frame counts. */
  t: number;
  landmarks: Landmark[] | null;
}

/** A saved session: the algorithms are pure functions of this. */
export interface LandmarkStream {
  version: 1;
  sessionId: string;
  /** performance.now() timestamp of the "go" audio cue (time zero), if any. */
  goCueT: number | null;
  videoWidth: number;
  videoHeight: number;
  frames: PoseFrame[];
}

/** MediaPipe Pose landmark indices used by Upright. */
export const LM = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;
