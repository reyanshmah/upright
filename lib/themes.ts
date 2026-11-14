export type ThemeId =
  | "clinic-light"
  | "clinic-dark"
  | "signal-dark"
  | "signal-light"
  | "low-glare";

export interface StatusColors {
  bg: string;
  fg: string;
  bd: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  scheme: "light" | "dark";
  family: "clinic" | "signal";
  bg: string;
  card: string;
  ink: string;
  ink2: string;
  line: string;
  act: string;
  onAct: string;
  actBd: string;
  ring: string;
  stop: string;
  stopFg: string;
  stopBd: string;
  slate: string;
  slateFg: string;
  slateBd: string;
  ok: StatusColors;
  risk: StatusColors;
  total: StatusColors;
  none: StatusColors;
  /** Neutral information (tips, notes). */
  info: StatusColors;
}

/*
 * Status colors (ok / warn = total / error = risk / info / none) are ONE
 * colour-blind-safe set (Okabe-Ito hues: bluish green, orange, vermillion,
 * blue) in every theme: a light-tint version for light themes and a dark-tint
 * version for dark themes (Nov 14, user-approved).
 * Agreed palettes: clinic-light, signal-light, signal-dark.
 * PROPOSED (not yet agreed; values must not be changed without sign-off):
 *    clinic-dark, low-glare.
 * tests/contrast.test.ts checks every pair and that styles/tokens.css matches.
 */
export const THEMES: Record<ThemeId, Theme> = {
  "clinic-light": {
    id: "clinic-light",
    name: "Clinic light",
    scheme: "light",
    family: "clinic",
    bg: "#F4F7FA",
    card: "#FFFFFF",
    ink: "#14212B",
    ink2: "#3A4B5A",
    line: "#C9D3DC",
    act: "#0B5CAD",
    onAct: "#FFFFFF",
    actBd: "none",
    ring: "#0B5CAD",
    stop: "#B3261E",
    stopFg: "#FFFFFF",
    stopBd: "none",
    slate: "#34424F",
    slateFg: "#FFFFFF",
    slateBd: "none",
    ok: { bg: "#E2F4EE", fg: "#00573F", bd: "#007A5E" },
    risk: { bg: "#FCE7DD", fg: "#983600", bd: "#C24E00" },
    total: { bg: "#FFF0D4", fg: "#6E4300", bd: "#A86A00" },
    none: { bg: "#E8ECF0", fg: "#34424F", bd: "#5B6875" },
    info: { bg: "#E3F0F9", fg: "#00507F", bd: "#0072B2" },
  },
  // PROPOSED palette, not yet agreed.
  "clinic-dark": {
    id: "clinic-dark",
    name: "Clinic dark",
    scheme: "dark",
    family: "clinic",
    bg: "#0E1621",
    card: "#162231",
    ink: "#F2F6FA",
    ink2: "#C3CFDB",
    line: "#2D3F54",
    act: "#8CC2FF",
    onAct: "#06223F",
    actBd: "none",
    ring: "#8CC2FF",
    stop: "#FF7B72",
    stopFg: "#2B0000",
    stopBd: "none",
    slate: "#2B3A4B",
    slateFg: "#FFFFFF",
    slateBd: "2px solid #C3CFDB",
    ok: { bg: "#0F3328", fg: "#7FE0BF", bd: "#2FBF8F" },
    risk: { bg: "#3F1D0E", fg: "#FFB38A", bd: "#F07A3A" },
    total: { bg: "#3B2A08", fg: "#FFD27A", bd: "#E6A11A" },
    none: { bg: "#26303B", fg: "#D6E0EA", bd: "#8C99A6" },
    info: { bg: "#0D2A40", fg: "#9CCFF2", bd: "#56B4E9" },
  },
  "signal-dark": {
    id: "signal-dark",
    name: "Signal dark",
    scheme: "dark",
    family: "signal",
    bg: "#0B0B0C",
    card: "#1A1A1D",
    ink: "#FFFFFF",
    ink2: "#E8E8E8",
    line: "#3A3A3F",
    act: "#FFD60A",
    onAct: "#000000",
    actBd: "none",
    ring: "#FFFFFF",
    stop: "#C62828",
    stopFg: "#FFFFFF",
    stopBd: "3px solid #FFFFFF",
    slate: "#1A1A1D",
    slateFg: "#FFFFFF",
    slateBd: "3px solid #FFFFFF",
    ok: { bg: "#0F3328", fg: "#7FE0BF", bd: "#2FBF8F" },
    risk: { bg: "#3F1D0E", fg: "#FFB38A", bd: "#F07A3A" },
    total: { bg: "#3B2A08", fg: "#FFD27A", bd: "#E6A11A" },
    none: { bg: "#26303B", fg: "#D6E0EA", bd: "#8C99A6" },
    info: { bg: "#0D2A40", fg: "#9CCFF2", bd: "#56B4E9" },
  },
  "signal-light": {
    id: "signal-light",
    name: "Signal light",
    scheme: "light",
    family: "signal",
    bg: "#FFFFFF",
    card: "#FFFFFF",
    ink: "#000000",
    ink2: "#1A1A1A",
    line: "#000000",
    act: "#FFD60A",
    onAct: "#000000",
    actBd: "3px solid #000000",
    ring: "#000000",
    stop: "#B00020",
    stopFg: "#FFFFFF",
    stopBd: "3px solid #000000",
    slate: "#FFFFFF",
    slateFg: "#000000",
    slateBd: "3px solid #000000",
    ok: { bg: "#E2F4EE", fg: "#00573F", bd: "#007A5E" },
    risk: { bg: "#FCE7DD", fg: "#983600", bd: "#C24E00" },
    total: { bg: "#FFF0D4", fg: "#6E4300", bd: "#A86A00" },
    none: { bg: "#E8ECF0", fg: "#34424F", bd: "#5B6875" },
    info: { bg: "#E3F0F9", fg: "#00507F", bd: "#0072B2" },
  },
  // PROPOSED palette, not yet agreed.
  "low-glare": {
    id: "low-glare",
    name: "Low glare",
    scheme: "dark",
    family: "clinic",
    bg: "#17130F",
    card: "#231D17",
    ink: "#EFE6D8",
    ink2: "#D2C6B4",
    line: "#3D342B",
    act: "#E8B04A",
    onAct: "#1B1204",
    actBd: "none",
    ring: "#F2C46D",
    stop: "#E0705F",
    stopFg: "#1F0A06",
    stopBd: "none",
    slate: "#332C25",
    slateFg: "#EFE6D8",
    slateBd: "2px solid #D2C6B4",
    ok: { bg: "#0F3328", fg: "#7FE0BF", bd: "#2FBF8F" },
    risk: { bg: "#3F1D0E", fg: "#FFB38A", bd: "#F07A3A" },
    total: { bg: "#3B2A08", fg: "#FFD27A", bd: "#E6A11A" },
    none: { bg: "#26303B", fg: "#D6E0EA", bd: "#8C99A6" },
    info: { bg: "#0D2A40", fg: "#9CCFF2", bd: "#56B4E9" },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function resolveDefaultTheme(prefersDark: boolean, prefersMoreContrast: boolean): ThemeId {
  if (prefersMoreContrast) return prefersDark ? "signal-dark" : "signal-light";
  return prefersDark ? "clinic-dark" : "clinic-light";
}

export const THEME_STORAGE_KEY = "upright-theme";
