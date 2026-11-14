"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LANGS, STRINGS, type Lang } from "../lib/i18n";
import {
  getAutoStart,
  getFontPref,
  getGuide,
  getSpacing,
  getTextScale,
  getVoiceSpeedPref,
  setAutoStart,
  setFontPref,
  setGuide,
  setSpacing,
  setTextScale,
  setVoiceSpeedPref,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  VOICE_SPEEDS,
  type AutoStart,
  type FontPref,
  type Guide,
  type Spacing,
  type VoiceSpeed,
} from "../lib/displayPrefs";
import { getThemePref, setThemePref, type ThemePref } from "../lib/themePref";
import { THEMES, type ThemeId } from "../lib/themes";
import { clearSession } from "../lib/session";
import { clearRuns } from "../lib/store";
import { speakText } from "../lib/voice";
import { Icon } from "./Icon";

/** Light and dark versions next to each other. */
const THEME_ORDER: ThemeId[] = ["clinic-light", "clinic-dark", "signal-light", "signal-dark", "low-glare"];

/**
 * Settings in one place, grouped under headings: language, reading (text
 * scale, font, line spacing, reading guide), sound, testing, colors, and your
 * data. Every change applies at once (the page behind updates live) and is
 * kept on this phone. A native <dialog> gives focus trapping, Esc to close
 * and focus return.
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
  const [scale, setScale] = useState(1);
  const [font, setFont] = useState<FontPref>("standard");
  const [spacing, setSpacingS] = useState<Spacing>("normal");
  const [guide, setGuideS] = useState<Guide>("off");
  const [theme, setTheme] = useState<ThemePref>("auto");
  const [speed, setSpeed] = useState<VoiceSpeed>("1");
  const [auto, setAuto] = useState<AutoStart>("off");
  const [del, setDel] = useState<"idle" | "confirm" | "done">("idle");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setScale(getTextScale());
      setFont(getFontPref());
      setSpacingS(getSpacing());
      setGuideS(getGuide());
      setTheme(getThemePref());
      setSpeed(getVoiceSpeedPref());
      setAuto(getAutoStart());
      setDel("idle");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const changeScale = (v: number) => {
    const s = Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, v)) * 100) / 100;
    setTextScale(s);
    setScale(s);
  };

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

        <h3 className="sheet__section">{t.setReading}</h3>

        <fieldset className="opt-group">
          <legend className="label">{t.textSizeLabel}</legend>
          <div className="scale">
            <button
              type="button"
              className="stepper__btn"
              aria-label={t.textSmaller}
              disabled={scale <= TEXT_SCALE_MIN}
              onClick={() => changeScale(scale - TEXT_SCALE_STEP)}
            >
              <Icon name="minus" size={26} />
            </button>
            <input
              className="scale__range"
              type="range"
              min={TEXT_SCALE_MIN}
              max={TEXT_SCALE_MAX}
              step={TEXT_SCALE_STEP}
              value={scale}
              aria-label={t.textSizeLabel}
              aria-valuetext={t.textScaleValue(Math.round(scale * 100))}
              onChange={(e) => changeScale(Number(e.target.value))}
            />
            <button
              type="button"
              className="stepper__btn"
              aria-label={t.textBigger}
              disabled={scale >= TEXT_SCALE_MAX}
              onClick={() => changeScale(scale + TEXT_SCALE_STEP)}
            >
              <Icon name="plus" size={26} />
            </button>
          </div>
          <p className="scale__value" aria-hidden>
            {t.textScaleValue(Math.round(scale * 100))}
          </p>
        </fieldset>

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

        <Group legend={t.spacingLabel}>
          {(["normal", "wide"] as const).map((v) => (
            <Option
              key={v}
              name="spacing"
              checked={spacing === v}
              onSelect={() => {
                setSpacing(v);
                setSpacingS(v);
              }}
            >
              {v === "normal" ? t.spacingNormal : t.spacingWide}
            </Option>
          ))}
        </Group>

        <Group legend={t.guideLabel}>
          {(["off", "on"] as const).map((v) => (
            <Option
              key={v}
              name="guide"
              checked={guide === v}
              onSelect={() => {
                setGuide(v);
                setGuideS(v);
              }}
            >
              {v === "off" ? t.guideOff : t.guideOn}
            </Option>
          ))}
          <p className="hint">{t.guideHint}</p>
        </Group>

        <p className="sheet__sample" aria-hidden>
          {t.textSample}
        </p>

        <h3 className="sheet__section">{t.setSound}</h3>

        <Group legend={t.voiceSpeedLabel}>
          {VOICE_SPEEDS.map((v) => (
            <Option
              key={v}
              name="voice-speed"
              checked={speed === v}
              onSelect={() => {
                setVoiceSpeedPref(v);
                setSpeed(v);
                speakText(lang, t.voiceSample);
              }}
            >
              {t.voiceSpeedNames[v]}
            </Option>
          ))}
          <p className="hint">{t.voiceSpeedHint}</p>
        </Group>

        <h3 className="sheet__section">{t.setTesting}</h3>

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

        <h3 className="sheet__section">{t.setColors}</h3>

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
                  <span className="swatch" aria-hidden style={{ background: THEMES[v].bg, borderColor: THEMES[v].line }}>
                    <span style={{ background: THEMES[v].act }} />
                    <span style={{ background: THEMES[v].ink }} />
                  </span>
                )}
                {v === "auto" ? t.themeAuto : t.themeNames[v]}
              </span>
            </Option>
          ))}
        </Group>

        <h3 className="sheet__section">{t.setData}</h3>

        <div className="opt-group stack-sm">
          <p className="hint">{t.deleteHint}</p>
          {del === "done" ? (
            <p className="callout callout--ok" role="status">
              {t.deleted}
            </p>
          ) : (
            <button
              type="button"
              className={`btn ${del === "confirm" ? "btn--stop" : "btn--secondary"}`}
              onClick={async () => {
                if (del === "idle") return setDel("confirm");
                clearSession();
                await clearRuns();
                setDel("done");
              }}
            >
              {del === "confirm" ? t.deleteConfirm : t.deleteBtn}
            </button>
          )}
          <p className="sheet__links">
            <Link href="/privacy" onClick={onClose}>
              {t.privacyLink}
            </Link>
            <span aria-hidden> · </span>
            <Link href="/terms" onClick={onClose}>
              {t.termsLinkShort}
            </Link>
          </p>
        </div>
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
