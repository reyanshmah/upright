import { LANGS, type Lang } from "./i18n";

/** The language chosen on this device, kept across visits (the session keeps its own copy per tab). */
const KEY = "upright-lang";
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

export function getLangPref(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** The saved choice, else the phone's own language if we have it, else English. */
export function detectLang(): Lang {
  const saved = getLangPref();
  if (saved) return saved;
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = tag.toLowerCase().split("-")[0];
      if (isLang(base)) return base;
    }
  } catch {
    /* no navigator (tests) */
  }
  return "en";
}

export function setLangPref(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode or storage blocked: the choice lasts for this page only */
  }
}
