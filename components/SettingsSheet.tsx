"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, STRINGS, type Lang } from "../lib/i18n";
import {
  getAutoStart,
  getFontPref,
  getTextSize,
  getVoiceSpeedPref,
  setAutoStart,
  setFontPref,
  setTextSize,
  setVoiceSpeedPref,
  VOICE_SPEEDS,
  type AutoStart,
  type FontPref,
  type TextSize,
  type VoiceSpeed,
} from "../lib/displayPrefs";
import { getThemePref, setThemePref, type ThemePref } from "../lib/themePref";
import { THEMES, type ThemeId } from "../lib/themes";

/** Light and dark versions next to each other. */
const THEME_ORDER: ThemeId[] = ["clinic-light", "clinic-dark", "signal-light", "signal-dark", "low-glare"];

/**
 * Settings in one place: language, text size, font, colors. Every change
 * applies at once (the page behind updates live) and is kept on this phone.
 * A native <dialog> gives focus trapping, Esc to close and focus return.
 */
export function SettingsSheet({
  open,
  onClose,
  lang,
  onLang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = STRINGS[lang];
  const [text, setText] = useState<TextSize>("standard");
  const [font, setFont] = useState<FontPref>("standard");
  const [theme, setTheme] = useState<ThemePref>("auto");
  const [speed, setSpeed] = useState<VoiceSpeed>("1");
  const [auto, setAuto] = useState<AutoStart>("off");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setText(getTextSize());
      setFont(getFontPref());
      setTheme(getThemePref());
      setSpeed(getVoiceSpeedPref());
      setAuto(getAutoStart());
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="settings-title" onClose={onClose}>
      <div className="sheet__head">
        <h2 className="h2" id="settings-title">
          {t.settings}
        </h2>
        <button type="button" className="btn btn--primary sheet__done" onClick={onClose}>
          {t.done}
        </button>
      </div>
      <div className="sheet__body">
        <Group legend={t.langGroup}>
          {LANGS.map((l) => (
            <Option key={l.code} name="lang" checked={lang === l.code} onSelect={() => onLang(l.code)} lang={l.code}>
              {l.nativeName}
            </Option>
          ))}
        </Group>

        <Group legend={t.textSizeLabel}>
          {(["standard", "large"] as const).map((v) => (
            <Option
              key={v}
              name="text"
              checked={text === v}
              onSelect={() => {
                setTextSize(v);
                setText(v);
              }}
            >
              <span className={v === "large" ? "opt__large" : undefined}>
                {v === "standard" ? t.textStandard : t.textLarge}
              </span>
            </Option>
          ))}
        </Group>

        <Group legend={t.fontLabel}>
          {(["standard", "dyslexic"] as const).map((v) => (
            <Option
              key={v}
              name="font"
              checked={font === v}
              onSelect={() => {
                setFontPref(v);
                setFont(v);
              }}
            >
              <span className={v === "dyslexic" ? "opt__dyslexic" : "opt__standard"}>
                {v === "standard" ? t.fontStandard : t.fontDyslexic}
              </span>
            </Option>
          ))}
        </Group>

        <Group legend={t.autoStartLabel}>
          {(["off", "on"] as const).map((v) => (
            <Option
              key={v}
              name="autostart"
              checked={auto === v}
              onSelect={() => {
                setAutoStart(v);
                setAuto(v);
              }}
            >
              {v === "on" ? t.autoStartOn : t.autoStartOff}
            </Option>
          ))}
          <p className="hint">{t.autoStartHint}</p>
        </Group>

        <Group legend={t.voiceSpeedLabel}>
          {VOICE_SPEEDS.map((v) => (
            <Option
              key={v}
              name="voice-speed"
              checked={speed === v}
              onSelect={() => {
                setVoiceSpeedPref(v);
                setSpeed(v);
              }}
            >
              {t.voiceSpeedNames[v]}
            </Option>
          ))}
          <p className="hint">{t.voiceSpeedHint}</p>
        </Group>

        <Group legend={t.themeLabel}>
          {(["auto", ...THEME_ORDER] as ThemePref[]).map((v) => (
            <Option
              key={v}
              name="theme"
              checked={theme === v}
              onSelect={() => {
                setThemePref(v);
                setTheme(v);
              }}
            >
              <span className="opt__theme">
                {v === "auto" ? (
                  <span
                    className="swatch"
                    aria-hidden
                    style={{
                      background: `linear-gradient(135deg, ${THEMES["clinic-light"].bg} 50%, ${THEMES["clinic-dark"].bg} 50%)`,
                      borderColor: THEMES["clinic-light"].line,
                    }}
                  />
                ) : (
                  <span
                    className="swatch"
                    aria-hidden
                    style={{ background: THEMES[v].bg, borderColor: THEMES[v].line }}
                  >
                    <span style={{ background: THEMES[v].act }} />
                    <span style={{ background: THEMES[v].ink }} />
                  </span>
                )}
                {v === "auto" ? t.themeAuto : t.themeNames[v]}
              </span>
            </Option>
          ))}
        </Group>

      </div>
    </dialog>
  );
}

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="opt-group">
      <legend className="label">{legend}</legend>
      <div className="opt-list">{children}</div>
    </fieldset>
  );
}

function Option({
  name,
  checked,
  onSelect,
  lang,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="opt" lang={lang}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span className="opt__dot" aria-hidden />
      <span className="opt__text">{children}</span>
    </label>
  );
}
