/**
 * How much the PHONE itself has turned, from its gyroscope (DeviceMotion).
 * Used to tell "the tester bumped or re-aimed the phone" apart from "the
 * person moved": small hand tremor and wobble cancel out and are ignored; a
 * real turn of more than MOTION.phoneMovedDeg pauses the start or stops the
 * run, because the picture no longer matches.
 *
 * The rotation is integrated with a slow leak (MOTION.leakS) so sensor drift
 * on some phones never adds up to a false "moved". iPhone asks permission for
 * motion data; requestMotionPermission() must run inside a tap. Without
 * permission or a gyroscope, phoneTurnDeg() is null and nothing is paused.
 */
import { MOTION } from "./signal/thresholds";

export interface Turn3 {
  a: number;
  b: number;
  g: number;
}

/** One gyroscope sample (deg/s) over dt seconds, with the slow leak. Pure, for tests. */
export function integrateTurn(turn: Turn3, rate: { alpha: number; beta: number; gamma: number }, dt: number): Turn3 {
  const keep = Math.exp(-dt / MOTION.leakS);
  return { a: turn.a * keep + rate.alpha * dt, b: turn.b * keep + rate.beta * dt, g: turn.g * keep + rate.gamma * dt };
}

export const turnDeg = (t: Turn3) => Math.hypot(t.a, t.b, t.g);

let turn: Turn3 = { a: 0, b: 0, g: 0 };
let lastT: number | null = null;
let listening = false;
let seen = false;

function onMotion(e: DeviceMotionEvent) {
  const r = e.rotationRate;
  if (!r || (r.alpha === null && r.beta === null && r.gamma === null)) return;
  seen = true;
  const now = performance.now();
  if (lastT !== null) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    turn = integrateTurn(turn, { alpha: r.alpha ?? 0, beta: r.beta ?? 0, gamma: r.gamma ?? 0 }, dt);
  }
  lastT = now;
}

/** Start listening (no-op without a motion sensor or before permission on iPhone). */
export function startPhoneMotion(): void {
  if (listening || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
  window.addEventListener("devicemotion", onMotion);
  listening = true;
}

/** Call inside a tap: iPhone shows its "motion and orientation" prompt once. */
export async function requestMotionPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  const D = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  if (D && typeof D.requestPermission === "function") {
    try {
      if ((await D.requestPermission()) !== "granted") return;
    } catch {
      return;
    }
  }
  startPhoneMotion();
}

/** Zero the turn: the phone's position now is "where it should stay". */
export function resetPhoneMotion(): void {
  turn = { a: 0, b: 0, g: 0 };
}

/** Degrees the phone has turned since the last reset (null = no motion data). */
export function phoneTurnDeg(): number | null {
  return seen ? turnDeg(turn) : null;
}

/** The phone moved enough that the picture no longer matches. */
export function phoneMoved(): boolean {
  const d = phoneTurnDeg();
  return d !== null && d > MOTION.phoneMovedDeg;
}
