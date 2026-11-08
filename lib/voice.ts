"use client";

import type { Lang } from "./i18n";

/**
 * Voice cues. PLACEHOLDER: uses the browser's built-in speech for now.
 * The plan calls for pre-recorded MP3s (consistent across phones, and the
 * "go" cue doubles as time zero). Drop files in public/audio/<lang>/<id>.mp3
 * and they are used automatically; speech is the fallback.
 */
export type CueId =
  | "ready"
  | "three"
  | "two"
  | "one"
  | "go"
  | "stop"
  | "measureStop"
  | "tooFar";

const cache = new Map<string, HTMLAudioElement | null>();

async function tryAudio(lang: Lang, id: CueId): Promise<HTMLAudioElement | null> {
  const key = `${lang}/${id}`;
  if (cache.has(key)) return cache.get(key)!;
  const src = `/audio/${key}.mp3`;
  try {
    const res = await fetch(src, { method: "HEAD" });
    const el = res.ok ? new Audio(src) : null;
    cache.set(key, el);
    return el;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Call once from a button tap so iOS allows audio later. */
export function unlockAudio(): void {
  try {
    const u = new SpeechSynthesisUtterance("");
    window.speechSynthesis?.speak(u);
  } catch {
    /* ignore */
  }
}

/** Plays a cue; resolves the moment playback starts (use as time zero). */
export async function playCue(lang: Lang, id: CueId, text: string): Promise<number> {
  const audio = await tryAudio(lang, id);
  if (audio) {
    audio.currentTime = 0;
    await audio.play().catch(() => undefined);
    return performance.now();
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "es" ? "es-US" : "en-US";
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* no speech available; the on-screen cue still shows */
  }
  return performance.now();
}
