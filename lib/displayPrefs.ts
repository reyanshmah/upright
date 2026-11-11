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
