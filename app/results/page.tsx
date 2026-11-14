"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { NeedStart } from "@/components/NeedStart";
import { ResultsView, type PlanState } from "@/components/ResultsView";
import { clearSession, loadSession, updateSession, type SessionState } from "@/lib/session";
import { setLangPref } from "@/lib/langPref";
import { buildReportInput } from "@/lib/reportgen/clientInput";
import type { ReportOutput } from "@/lib/reportgen/schema";

/** Longer than the server's 15 s model budget, so its template fallback can still arrive. */
const REPORT_WAIT_MS = 20_000;

export default function Results() {
  const router = useRouter();
  const [s, setS] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<PlanState>({ state: "standard" });
  useEffect(() => {
    setS(loadSession());
    setLoaded(true);
  }, []);

  // Ask the report service for a plan written for these results (numbers only leave the phone).
  const lang = s?.lang;
  useEffect(() => {
    if (!s) return;
    // The balance test is sent too (Nov 14), so every session can get a written plan.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPlan({ state: "offline" });
      updateSession({ reportSource: "local" });
      return;
    }
    let cancelled = false; // left the screen or changed language: drop this answer
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REPORT_WAIT_MS);
    setPlan({ state: "loading" });
    fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildReportInput(s)),
      signal: ctl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          report: ReportOutput;
          source: "model" | "regenerated" | "template";
          rejectedAttempts?: number;
          modelError?: string;
        };
        if (cancelled) return;
        updateSession({ reportSource: body.source });
        // Only a checked model plan replaces the on-device one; the server template matches it.
        if (body.source !== "template" && body.report?.familySteps?.length) setPlan({ state: "ai", output: body.report });
        // Say why: the API call failed (with its error kind), the drafts failed the checks, or there is no key.
        else if (body.modelError) setPlan({ state: "standard", reason: "api", detail: body.modelError });
        else setPlan({ state: "standard", reason: (body.rejectedAttempts ?? 0) > 0 ? "checks" : "no_key" });
      })
      .catch(() => {
        if (cancelled) return; // a timeout still falls back below
        updateSession({ reportSource: "local" });
        setPlan(navigator.onLine === false ? { state: "offline" } : { state: "standard", reason: "error" });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctl.abort();
    };
    // Re-ask only when the language changes; the results themselves are fixed on this screen.
  }, [loaded, lang]);

  if (!loaded) return null;
  if (!s) return <NeedStart what="results" />;

  return (
    <ResultsView
      s={s}
      plan={plan}
      onLang={(l: Lang) => {
        setLangPref(l);
        updateSession({ lang: l });
        setS({ ...s, lang: l });
      }}
      onRedoTug={() => router.push("/test/tug")}
      onNewScreen={() => {
        clearSession();
        router.push("/start");
      }}
    />
  );
}
