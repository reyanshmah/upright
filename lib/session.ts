import type { Lang } from "./i18n";
import type { Sex } from "./signal/thresholds";
import type { ChairStandResult, TugResult } from "./contract";
import { TUG } from "./signal/thresholds";

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

/** Which camera recorded the test (for the quality line). */
export interface CameraInfo {
  label: string;
  zoom: number | null;
  wide: boolean;
}

/**
 * Stored results ARE the engine contract (lib/contract.ts). Anything the UI
 * needs beyond the contract is added here as a local extra, never in the contract.
 */
export type TugEntry = TugResult & { camera?: CameraInfo };
/** halfwayCounted: last stand counted under the CDC "more than halfway up at 30 s" rule. */
export type ChairEntry = ChairStandResult & { halfwayCounted: boolean; camera?: CameraInfo };

export interface BalanceStageResult {
  stage: 1 | 2 | 3 | 4;
  heldS: number;
  completed: boolean;
  stanceVerified: boolean;
  sway: number | null;
}

export interface BalanceResult {
  stages: BalanceStageResult[];
  /** CDC: tandem stance (stage 3) held 10 s. */
  tandemHeld10: boolean;
  source: "auto" | "manual";
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
  tug?: TugEntry | { skipped: true; reason: string };
  chair?: ChairEntry | { skipped: true; reason: string };
  balance?: BalanceResult | { skipped: true; reason: string };
  /** Which path wrote the family plan text (MASTER.md report pipeline, step 8). "local" = offline/failed, on-device template. */
  reportSource?: "model" | "regenerated" | "template" | "local";
  createdAt: string;
}

export function isSkipped(r: unknown): r is { skipped: true; reason: string } {
  return !!r && typeof r === "object" && "skipped" in r;
}

/** The TUG entry only if it carries a number (not skipped, not refused). */
export function tugMeasured(r: SessionState["tug"]): (TugEntry & { totalSec: number }) | null {
  return r && !isSkipped(r) && r.outcome !== "refused" && r.totalSec !== null ? (r as TugEntry & { totalSec: number }) : null;
}

/** The chair entry only if it carries a count (not skipped, not refused). */
export function chairMeasured(r: SessionState["chair"]): (ChairEntry & { stands: number }) | null {
  return r && !isSkipped(r) && r.outcome !== "refused" && r.stands !== null ? (r as ChairEntry & { stands: number }) : null;
}

/** TUG >= 20 s: the app suggests skipping the chair stand for safety. */
export function tugVerySlow(r: SessionState["tug"]): boolean {
  const m = tugMeasured(r);
  return !!m && m.totalSec >= TUG.verySlowS;
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
