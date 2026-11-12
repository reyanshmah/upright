"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STRINGS, type Lang } from "@/lib/i18n";
import { detectLang, setLangPref } from "@/lib/langPref";
import { AppShell } from "@/components/AppShell";
import { Icon, type IconName } from "@/components/Icon";

const NEED_ICONS: IconName[] = ["chair", "floor", "people"];

export default function Home() {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => setLang(detectLang()), []);
  if (!lang) return null;
  const t = STRINGS[lang];
  return (
    <AppShell
      lang={lang}
      onLang={(l) => {
        setLangPref(l);
        setLang(l);
      }}
      pinned={
        <Link className="btn btn--primary" href="/start">
          {t.homeStart}
        </Link>
      }
    >
      <section className="hero">
        <img className="hero__logo" src="/icons/icon-192.png" width={88} height={88} alt="" />
        <h1 className="h1">{t.homeTitle}</h1>
        <p className="lead">{t.homeSub}</p>
      </section>

      <section className="stack-sm" aria-labelledby="need-title">
        <h2 className="label" id="need-title">
          {t.homeNeedTitle}
        </h2>
        <ul className="icon-list">
          {t.homeNeed.map((item, i) => (
            <li key={i}>
              <span className="icon-list__icon">
                <Icon name={NEED_ICONS[i] ?? "check"} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="footnote">
        <Icon name="lock" size={20} />
        <span>{t.homePrivacy}</span>
      </p>

      {/* The pose debug page is for the team; families never see this link. */}
      {process.env.NODE_ENV !== "production" && (
        <p>
          <Link href="/pose" className="dev-link">
            {t.devLink}
          </Link>
        </p>
      )}
    </AppShell>
  );
}
