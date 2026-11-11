export type ThemeId =
  | "clinic-light"
  | "clinic-dark"
  | "signal-dark"
  | "signal-light"
  | "cvd-safe"
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
}

/*
 * Agreed palettes: clinic-light, signal-light, signal-dark.
 * PROPOSED (not yet agreed; values must not be changed without sign-off):
 * clinic-dark, cvd-safe, low-glare.
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
    ok: { bg: "#E3F3EC", fg: "#0B6B4F", bd: "#0B6B4F" },
    risk: { bg: "#FDE9E7", fg: "#A12622", bd: "#A12622" },
    total: { bg: "#FFF1D6", fg: "#7A4300", bd: "#7A4300" },
    none: { bg: "#E4E9EE", fg: "#34424F", bd: "#34424F" },
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
    ok: { bg: "#12382B", fg: "#8EE6B8", bd: "#8EE6B8" },
    risk: { bg: "#4A1B1B", fg: "#FFB4AB", bd: "#FFB4AB" },
    total: { bg: "#4A3410", fg: "#FFD58A", bd: "#FFD58A" },
    none: { bg: "#263444", fg: "#D6E0EA", bd: "#D6E0EA" },
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
    ok: { bg: "#1A1A1D", fg: "#FFFFFF", bd: "#4ADE80" },
    risk: { bg: "#1A1A1D", fg: "#FFFFFF", bd: "#FF6B5E" },
    total: { bg: "#1A1A1D", fg: "#FFFFFF", bd: "#FFB020" },
    none: { bg: "#1A1A1D", fg: "#FFFFFF", bd: "#C9D1D9" },
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
    ok: { bg: "#FFFFFF", fg: "#000000", bd: "#006B2E" },
    risk: { bg: "#FFFFFF", fg: "#000000", bd: "#B00020" },
    total: { bg: "#FFFFFF", fg: "#000000", bd: "#8A5A00" },
    none: { bg: "#FFFFFF", fg: "#000000", bd: "#333333" },
  },
  // PROPOSED palette, not yet agreed.
  "cvd-safe": {
    id: "cvd-safe",
    name: "Color-blind safe",
    scheme: "light",
    family: "clinic",
    bg: "#F5F7F8",
    card: "#FFFFFF",
    ink: "#111827",
    ink2: "#374151",
    line: "#CBD2D9",
    act: "#0B5CAD",
    onAct: "#FFFFFF",
    actBd: "none",
    ring: "#0B5CAD",
    stop: "#8A1C1C",
    stopFg: "#FFFFFF",
    stopBd: "none",
    slate: "#374151",
    slateFg: "#FFFFFF",
    slateBd: "none",
    ok: { bg: "#E3EEFA", fg: "#0B4F94", bd: "#0B4F94" },
    risk: { bg: "#FDEBDD", fg: "#8F3600", bd: "#8F3600" },
    total: { bg: "#FFF3BF", fg: "#5C4500", bd: "#5C4500" },
    none: { bg: "#E5E7EB", fg: "#374151", bd: "#374151" },
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
    ok: { bg: "#1E3A2A", fg: "#B8E6C4", bd: "#B8E6C4" },
    risk: { bg: "#4A2220", fg: "#FFC2B8", bd: "#FFC2B8" },
    total: { bg: "#4A3A12", fg: "#F5D68A", bd: "#F5D68A" },
    none: { bg: "#332C25", fg: "#DDD2C2", bd: "#DDD2C2" },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function resolveDefaultTheme(prefersDark: boolean, prefersMoreContrast: boolean): ThemeId {
  if (prefersMoreContrast) return prefersDark ? "signal-dark" : "signal-light";
  return prefersDark ? "clinic-dark" : "clinic-light";
}

export const THEME_STORAGE_KEY = "upright-theme";
