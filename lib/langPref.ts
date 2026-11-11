import type { Lang } from "./i18n";

/** The language chosen on this device, kept across visits (the session keeps its own copy per tab). */
const KEY = "upright-lang";

export function getLangPref(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" || v === "es" ? v : null;
  } catch {
    return null;
  }
}

export function setLangPref(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode or storage blocked: the choice lasts for this page only */
  }
}
