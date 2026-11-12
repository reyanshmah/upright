"use client";

import { useEffect, useState, type ReactNode } from "react";
import { STRINGS, type Lang } from "../lib/i18n";
import { Icon } from "./Icon";
import { SettingsSheet } from "./SettingsSheet";

/**
 * Every screen: a quiet header (logo + name, one Settings button), one
 * scrolling content region that ends with the disclaimer, and an optional
 * bottom bar pinned outside the scroll (primary action, Stop).
 * Language, text size, font and colors all live in Settings.
 */
export function AppShell({
  lang,
  onLang,
  pinned,
  disclaimer,
  children,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  pinned?: ReactNode;
  disclaimer?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = STRINGS[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="app" lang={lang}>
      <header className="app__header">
        <span className="app__name">
          <img className="app__logo" src="/icons/logo-64.png" width={32} height={32} alt="" />
          <span>Upright</span>
        </span>
        <button
          type="button"
          className="header-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Icon name="settings" />
          <span>{t.settings}</span>
        </button>
      </header>
      <main className="app__scroll">
        {children}
        <footer className="disclaimer">{disclaimer ?? <p>{t.disclaimer}</p>}</footer>
      </main>
      {pinned && <div className="pinned">{pinned}</div>}
      <SettingsSheet open={open} onClose={() => setOpen(false)} lang={lang} onLang={onLang} />
    </div>
  );
}

/** Bottom-bar layout: an optional Back next to the main action. */
export function PinnedRow({ back, backLabel, children }: { back?: () => void; backLabel: string; children: ReactNode }) {
  return (
    <div className="pinned__row">
      {back && (
        <button type="button" className="btn btn--secondary pinned__back" onClick={back}>
          <Icon name="back" />
          <span>{backLabel}</span>
        </button>
      )}
      {children}
    </div>
  );
}
