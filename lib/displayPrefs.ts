/**
 * Reading preferences kept on this device: text size and font.
 * Applied as attributes on <html> (data-text, data-font) so CSS can switch
 * them; app/layout.tsx sets them before first paint from the same keys.
 */
export type TextSize = "standard" | "large";
export type FontPref = "standard" | "dyslexic";

export const TEXT_KEY = "upright-text";
export const FONT_KEY = "upright-font";
export const TEXT_SIZES: readonly TextSize[] = ["standard", "large"];
export const FONT_PREFS: readonly FontPref[] = ["standard", "dyslexic"];

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

export const getTextSize = () => read(TEXT_KEY, TEXT_SIZES, "standard");
export const getFontPref = () => read(FONT_KEY, FONT_PREFS, "standard");

export function setTextSize(v: TextSize): void {
  write(TEXT_KEY, v);
  document.documentElement.dataset.text = v;
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
