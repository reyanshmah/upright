"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { STRINGS, type Lang } from "../lib/i18n";
import { Icon } from "./Icon";
import { SettingsSheet } from "./SettingsSheet";
import { speakText, stopCues, unlockAudio } from "../lib/voice";
import { requestMotionPermission } from "../lib/motion";

/** The words on the screen, in reading order, for "Read this screen aloud". */
function screenText(root: HTMLElement): string {
  const out: string[] = [];
  const picked: Element[] = [];
  root.querySelectorAll("h1, h2, h3, p, li, legend, .choice__text, .opt__text").forEach((el) => {
    if (el.closest('[aria-hidden="true"], .stage, .sr-skip')) return;
    if (picked.some((p) => p.contains(el))) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    picked.push(el);
    out.push(/[.!?:…]$/.test(text) ? text : `${text}.`);
  });
  return out.join(" ");
}

/** Settings > Reading guide: a band that follows the finger to keep the reader's place. */
function ReadingGuide() {
  const [on, setOn] = useState(false);
  const [y, setY] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.guide === "on");
    sync();
    window.addEventListener("upright-guide", sync);
    return () => window.removeEventListener("upright-guide", sync);
  }, []);
  useEffect(() => {
    if (!on) return;
    const pointer = (e: PointerEvent) => setY(e.clientY);
    const touch = (e: TouchEvent) => e.touches[0] && setY(e.touches[0].clientY);
    document.addEventListener("pointerdown", pointer, { passive: true });
    document.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("touchmove", touch, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("pointermove", pointer);
      document.removeEventListener("touchmove", touch);
    };
  }, [on]);
  if (!on) return null;
  return <div className="reading-guide" style={{ top: y ?? "40%" }} aria-hidden />;
}

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
  scrollKey,
  children,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  pinned?: ReactNode;
  disclaimer?: ReactNode;
  /** When this changes (e.g. a test moves to its next phase), the content scrolls back to the top. */
  scrollKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  // Show "Stop reading" only while the voice is actually speaking.
  useEffect(() => {
    if (!reading) return;
    const id = setInterval(() => {
      if (!window.speechSynthesis?.speaking) setReading(false);
    }, 400);
    return () => clearInterval(id);
  }, [reading]);
  const readAloud = () => {
    if (reading) {
      stopCues();
      setReading(false);
      return;
    }
    const root = scrollRef.current;
    if (!root) return;
    speakText(lang, screenText(root));
    setReading(true);
  };
  useEffect(() => {
    if (scrollKey !== undefined) scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);
  const t = STRINGS[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // iPhone plays sound only after a tap. Any tap on any screen unlocks it for
  // the session, so Auto-start can speak without the "Check position" tap.
  useEffect(() => {
    const unlock = () => {
      unlockAudio(lang);
      // Motion data (to tell a moved phone from a moving person) on the test screens only;
      // iPhone shows its permission prompt once, and only inside a tap.
      if (/^\/(setup|test)/.test(window.location.pathname)) void requestMotionPermission();
    };
    document.addEventListener("pointerdown", unlock, { passive: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, [lang]);

  return (
    <div className="app" lang={lang}>
      <header className="app__header">
        <span className="app__name">
          <img className="app__logo" src="/icons/logo-64.png" width={32} height={32} alt="" />
          <span>Upright</span>
        </span>
        <span className="app__actions">
        <button
          type="button"
          className={`header-btn header-btn--icon ${reading ? "is-on" : ""}`}
          aria-label={reading ? t.stopReading : t.readScreen}
          title={reading ? t.stopReading : t.readScreen}
          aria-pressed={reading}
          onClick={readAloud}
        >
          <Icon name={reading ? "stop" : "speaker"} />
        </button>
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
        </span>
      </header>
      <main className="app__scroll" ref={scrollRef}>
        {children}
        <footer className="disclaimer">{disclaimer ?? <p>{t.disclaimer}</p>}</footer>
      </main>
      {pinned && <div className="pinned">{pinned}</div>}
      <SettingsSheet open={open} onClose={() => setOpen(false)} lang={lang} onLang={onLang} />
      <ReadingGuide />
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
