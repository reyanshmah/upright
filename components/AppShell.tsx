"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { STRINGS, type Lang } from "../lib/i18n";
import { getFontPref, getTextSize, setFontPref, setTextSize, type FontPref, type TextSize } from "../lib/displayPrefs";

/**
 * Every screen: header (logo + name, text and font settings, English/Español),
 * one scrolling content region, and an optional bottom bar pinned outside the
 * scroll (primary action, Stop). The disclaimer closes the scroll region on
 * every screen.
 */
export function AppShell({
  lang,
  onLang,
  pinned,
  disclaimer,
  children,
}: {
  /** null when no language has been chosen yet (both are then shown). */
  lang: Lang | null;
  onLang: (l: Lang) => void;
  pinned?: ReactNode;
  disclaimer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (lang) document.documentElement.lang = lang;
  }, [lang]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState<TextSize>("standard");
  const [font, setFont] = useState<FontPref>("standard");
  useEffect(() => {
    setText(getTextSize());
    setFont(getFontPref());
  }, []);
  const panelId = useId();

  // Before a language is chosen, every label is shown in both languages.
  const s = (k: keyof typeof STRINGS.en) =>
    lang ? (STRINGS[lang][k] as string) : `${STRINGS.en[k] as string} / ${STRINGS.es[k] as string}`;

  return (
    <div className="app" lang={lang ?? undefined}>
      <header className="app__header">
        <span className="app__name">
          <img className="app__logo" src="/icons/logo-64.png" width={32} height={32} alt="" />
          <span className="app__word">Upright</span>
        </span>
        <div className="app__tools">
          <button
            type="button"
            className="display-btn"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={s("displayTitle")}
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden>Aa</span>
          </button>
          <div className="lang-toggle" role="group" aria-label={s("langGroup")}>
            <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => onLang("en")}>
              English
            </button>
            <button type="button" lang="es" aria-pressed={lang === "es"} onClick={() => onLang("es")}>
              Español
            </button>
          </div>
        </div>
        {open && (
          <div className="display-panel" id={panelId}>
            <div className="seg" role="group" aria-label={s("textSizeLabel")}>
              <span className="seg__label">{s("textSizeLabel")}</span>
              {(["standard", "large"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={text === v}
                  onClick={() => {
                    setTextSize(v);
                    setText(v);
                  }}
                >
                  {s(v === "standard" ? "textStandard" : "textLarge")}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label={s("fontLabel")}>
              <span className="seg__label">{s("fontLabel")}</span>
              {(["standard", "dyslexic"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={v === "dyslexic" ? "seg__dyslexic" : undefined}
                  aria-pressed={font === v}
                  onClick={() => {
                    setFontPref(v);
                    setFont(v);
                  }}
                >
                  {s(v === "standard" ? "fontStandard" : "fontDyslexic")}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="app__scroll">
        {children}
        <div className="disclaimer">
          {disclaimer ??
            (lang ? (
              <p>{STRINGS[lang].disclaimer}</p>
            ) : (
              <>
                <p lang="en">{STRINGS.en.disclaimer}</p>
                <p lang="es">{STRINGS.es.disclaimer}</p>
              </>
            ))}
        </div>
      </main>
      {pinned && <div className="pinned">{pinned}</div>}
    </div>
  );
}
