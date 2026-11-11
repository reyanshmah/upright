import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrast } from "../lib/contrast";
import { THEMES, THEME_IDS } from "../lib/themes";

const TEXT = 4.5;
const NON_TEXT = 3;

interface Check {
  label: string;
  fg: string;
  bg: string;
  min: number;
}

function checksFor(id: (typeof THEME_IDS)[number]): Check[] {
  const t = THEMES[id];
  const list: Check[] = [
    { label: "ink on page", fg: t.ink, bg: t.bg, min: TEXT },
    { label: "ink on card", fg: t.ink, bg: t.card, min: TEXT },
    { label: "secondary on page", fg: t.ink2, bg: t.bg, min: TEXT },
    { label: "secondary on card", fg: t.ink2, bg: t.card, min: TEXT },
    { label: "primary button text", fg: t.onAct, bg: t.act, min: TEXT },
    { label: "stop button text", fg: t.stopFg, bg: t.stop, min: TEXT },
    { label: "not-ready button text", fg: t.slateFg, bg: t.slate, min: TEXT },
    { label: "focus ring on page", fg: t.ring, bg: t.bg, min: NON_TEXT },
    { label: "focus ring on card", fg: t.ring, bg: t.card, min: NON_TEXT },
  ];
  for (const k of ["ok", "risk", "total", "none"] as const) {
    const s = t[k];
    list.push({ label: `${k} text`, fg: s.fg, bg: s.bg, min: TEXT });
    list.push({ label: `${k} icon and border on its fill`, fg: s.bd, bg: s.bg, min: NON_TEXT });
    list.push({ label: `${k} icon and border on page`, fg: s.bd, bg: t.bg, min: NON_TEXT });
  }
  return list;
}

const report: Record<string, Record<string, string>> = {};

describe.each(THEME_IDS)("%s", (id) => {
  const checks = checksFor(id);
  report[id] = {};
  it.each(checks)("$label meets $min:1", ({ label, fg, bg, min }) => {
    const ratio = contrast(fg, bg);
    report[id][label] = ratio.toFixed(2);
    expect(ratio, `${id}: ${label} (${fg} on ${bg}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
  });

  it("a button that blends into the page has a visible border", () => {
    const t = THEMES[id];
    if (contrast(t.act, t.bg) < NON_TEXT) expect(t.actBd).not.toBe("none");
    if (contrast(t.stop, t.bg) < NON_TEXT) expect(t.stopBd).not.toBe("none");
    if (contrast(t.slate, t.bg) < NON_TEXT) expect(t.slateBd).not.toBe("none");
  });
});

describe("tokens.css stays in sync with themes.ts", () => {
  const css = readFileSync(resolve(__dirname, "../styles/tokens.css"), "utf8");

  function blockFor(id: string): string {
    const selector = id === "clinic-light" ? ':root,\n[data-theme="clinic-light"] {' : `[data-theme="${id}"] {`;
    const start = css.indexOf(selector);
    expect(start, `no block for ${id}`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  }

  it.each(THEME_IDS)("%s", (id) => {
    const t = THEMES[id];
    const block = blockFor(id);
    const expected: Record<string, string> = {
      "--bg": t.bg, "--card": t.card, "--ink": t.ink, "--ink-2": t.ink2, "--line": t.line,
      "--act": t.act, "--on-act": t.onAct, "--act-bd": t.actBd, "--ring": t.ring,
      "--stop": t.stop, "--stop-fg": t.stopFg, "--stop-bd": t.stopBd,
      "--slate": t.slate, "--slate-fg": t.slateFg, "--slate-bd": t.slateBd,
    };
    for (const k of ["ok", "risk", "total", "none"] as const) {
      expected[`--${k}-bg`] = t[k].bg;
      expected[`--${k}-fg`] = t[k].fg;
      expected[`--${k}-bd`] = t[k].bd;
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(block, `${id}: ${name} should be ${value}`).toContain(`${name}: ${value};`);
    }
  });
});

afterAll(() => {
  console.log("\nContrast report (ratio per check)");
  console.table(report);
});
