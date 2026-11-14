/**
 * Reading preferences kept on this device: text scale, font, line spacing and
 * the reading guide. Applied on <html> (--text-scale, data-font,
 * data-spacing, data-guide) so CSS can switch them; app/layout.tsx applies
 * them before first paint from the same keys.
 */
export type FontPref = "standard" | "dyslexic";
export type Spacing = "normal" | "wide";
export type Guide = "off" | "on";

/** Old two-step size ("standard" | "large"); read once to carry "large" over to 1.2x. */
export const TEXT_KEY = "upright-text";
export const TEXT_SCALE_KEY = "upright-text-scale";
export const TEXT_SCALE_MIN = 0.75;
export const TEXT_SCALE_MAX = 1.25;
export const TEXT_SCALE_STEP = 0.05;
export const FONT_KEY = "upright-font";
export const SPACING_KEY = "upright-spacing";
export const GUIDE_KEY = "upright-guide";
export const FONT_PREFS: readonly FontPref[] = ["standard", "dyslexic"];
export const SPACINGS: readonly Spacing[] = ["normal", "wide"];
export const GUIDES: readonly Guide[] = ["off", "on"];

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage blocked: the choice lasts for this page only */
  }
}

export const getFontPref = () => read(FONT_KEY, FONT_PREFS, "standard");
export const getSpacing = () => read(SPACING_KEY, SPACINGS, "normal");
export const getGuide = () => read(GUIDE_KEY, GUIDES, "off");

/** Text scale on top of the phone's own text size: 0.75x to 1.25x. */
export function getTextScale(): number {
  try {
    const v = Number(localStorage.getItem(TEXT_SCALE_KEY));
    if (v >= TEXT_SCALE_MIN && v <= TEXT_SCALE_MAX) return v;
    return localStorage.getItem(TEXT_KEY) === "large" ? 1.2 : 1;
  } catch {
    return 1;
  }
}

export function setTextScale(v: number): void {
  const s = Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, v)) * 100) / 100;
  write(TEXT_SCALE_KEY, String(s));
  document.documentElement.style.setProperty("--text-scale", String(s));
}

export function setSpacing(v: Spacing): void {
  write(SPACING_KEY, v);
  document.documentElement.dataset.spacing = v;
}

/** The reading guide component listens for this event to show or hide itself. */
export function setGuide(v: Guide): void {
  write(GUIDE_KEY, v);
  document.documentElement.dataset.guide = v;
  window.dispatchEvent(new Event("upright-guide"));
}

export function setFontPref(v: FontPref): void {
  write(FONT_KEY, v);
  document.documentElement.dataset.font = v;
}

/**
 * Voice speed for the read-aloud instructions and short cues (accessibility).
 * The 3-2-1 / Go / Stop cues always play at normal speed, because Go is the
 * test's time zero.
 */
export type VoiceSpeed = "1" | "0.75" | "0.5";
export const VOICE_SPEED_KEY = "upright-voice-speed";
export const VOICE_SPEEDS: readonly VoiceSpeed[] = ["1", "0.75", "0.5"];

export const getVoiceSpeedPref = () => read(VOICE_SPEED_KEY, VOICE_SPEEDS, "1");
/** The speed as a number (1 = normal, 0.5 = half speed). */
export const getVoiceRate = (): number => Number(getVoiceSpeedPref());

export function setVoiceSpeedPref(v: VoiceSpeed): void {
  write(VOICE_SPEED_KEY, v);
}

/**
 * Auto-start: each test opens the camera by itself, starts as soon as every
 * check is green (the same hold as the Start button, GATES.allGreenHoldMs),
 * and moves on (or retries) after the result, so someone testing alone never
 * has to reach for the phone.
 */
export type AutoStart = "off" | "on";
export const AUTO_START_KEY = "upright-autostart";
export const AUTO_STARTS: readonly AutoStart[] = ["off", "on"];
export const getAutoStart = () => read(AUTO_START_KEY, AUTO_STARTS, "off");
export function setAutoStart(v: AutoStart): void {
  write(AUTO_START_KEY, v);
}
