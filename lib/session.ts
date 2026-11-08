import type { Lang } from "./i18n";
import type { Sex } from "./signal/thresholds";

export type Runner = "self" | "helper";
export type WalkingAid = "none" | "cane" | "walker" | "other";
export type FallCount = "1" | "2" | "3+";

export interface Profile {
  /** Optional, stays on the phone; never sent to the server. */
  firstName: string;
  age: number;
  sex: Sex;
  walkingAid: WalkingAid;
  /** Standing height (cm). Kept for the clinician summary. */
  heightCm: number;
}

export interface Screening {
  unsteady: boolean;
  worry: boolean;
  fallen: boolean;
  /** Only asked when fallen = true (STEADI follow-ups). */
  fallCount: FallCount | null;
  injured: boolean | null;
}

/** Where a number came from. "auto" = camera analysis, "manual" = helper's tap/count. */
export type Source = "auto" | "manual";

export interface TugResult {
  totalS: number;
  source: Source;
  /** Helper's tap-to-tap time, always kept for the stopwatch comparison. */
  manualS: number | null;
  /** Observations from the CDC TUG form. */
  observations: string[];
  lookedUnsteady: boolean;
  fpsMedian: number | null;
  gatesPassed: boolean;
  camera?: CameraInfo;
}

/** Which camera recorded the test (for the quality line). */
export interface CameraInfo {
  label: string;
  zoom: number | null;
  wide: boolean;
}

export interface ChairResult {
  count: number;
  armsUsed: boolean;
  source: Source;
  manualCount: number | null;
  fpsMedian: number | null;
  gatesPassed: boolean;
  camera?: CameraInfo;
}

export interface SetupInfo {
  safetyConfirmed: boolean;
  /** How the 3 m line was laid out. */
  lineMethod: "ar" | "tape" | null;
  /** Distance AR measured when the helper marked the line (meters). */
  cameraMeasuredM: number | null;
}

export interface SessionState {
  lang: Lang;
  runner: Runner;
  profile: Profile;
  screening: Screening;
  setup?: SetupInfo;
  tug?: TugResult | { skipped: true; reason: string };
  chair?: ChairResult | { skipped: true; reason: string };
  createdAt: string;
}

export function isSkipped(r: unknown): r is { skipped: true; reason: string } {
  return !!r && typeof r === "object" && "skipped" in r;
}

/** STEADI: a yes to any of the three key questions means screened at risk. */
export function screenedAtRisk(s: Screening): boolean {
  return s.unsteady || s.worry || s.fallen;
}

export const STEADI_MIN_AGE = 65;

const KEY = "upright.session.v1";

/**
 * sessionStorage, not localStorage: the name and answers disappear when the
 * tab closes, so nothing personal lingers on a shared family phone.
 */
export function saveSession(s: SessionState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked (private mode) */
  }
}

export function loadSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

export function updateSession(patch: Partial<SessionState>): SessionState | null {
  const cur = loadSession();
  if (!cur) return null;
  const next = { ...cur, ...patch };
  saveSession(next);
  return next;
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
