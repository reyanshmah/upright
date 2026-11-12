import { resolveDefaultTheme, THEMES, THEME_IDS, THEME_STORAGE_KEY, type ThemeId } from "./themes";

/** "auto" = follow the phone's dark-mode and more-contrast settings (nothing saved). */
export type ThemePref = ThemeId | "auto";

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return (THEME_IDS as string[]).includes(v ?? "") ? (v as ThemeId) : "auto";
  } catch {
    return "auto";
  }
}

function systemTheme(): ThemeId {
  const m = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  return resolveDefaultTheme(m("(prefers-color-scheme: dark)"), m("(prefers-contrast: more)"));
}

export function setThemePref(v: ThemePref): void {
  try {
    if (v === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, v);
  } catch {
    /* storage blocked: applies to this page only */
  }
  const id = v === "auto" ? systemTheme() : v;
  document.documentElement.setAttribute("data-theme", id);
  syncBrowserBar(id);
}

/** The browser's address-bar color follows the chosen theme. */
export function syncBrowserBar(id: ThemeId): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", THEMES[id].bg);
    m.removeAttribute("media");
  });
}
