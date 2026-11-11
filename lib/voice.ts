"use client";

import type { Lang } from "./i18n";
import { audibleOnsetMs } from "./audioOnset";

/**
 * Voice cues. Recorded EN/ES cues for 3-2-1, Go and Stop live in
 * public/audio/<lang>/<id>.mp3 (cut from the ElevenLabs takes; each file starts
 * ~15 ms before the word). They play through Web Audio and the "go" cue is time
 * zero. Every other cue (instructions, "done") still uses the browser's speech,
 * which starts after a variable, unmeasured delay; an <id>.mp3 dropped into
 * public/audio is picked up by the HTMLAudio fallback below.
 */
export type CueId =
  | "ready"
  | "three"
  | "two"
  | "one"
  | "go"
  | "stop"
  | "measureStop"
  | "tooFar"
  | "tugInstr"
  | "chairInstr"
  | "done"
  | "armsUsed"
  | "balIntro"
  | "bal1"
  | "bal2"
  | "bal3"
  | "bal4"
  | "hold"
  | "good";

let lastCueSource: "mp3" | "speech" | "unknown" = "unknown";
/** How the most recent cue was produced (recorded in the session file). */
export function getLastCueSource() {
  return lastCueSource;
}

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

/*
 * Recorded cues (public/audio/<lang>/{three,two,one,go,stop}.mp3) play through
 * Web Audio: iPhone only allows sound started from a tap, so the AudioContext
 * is unlocked in the Start tap and the buffers are decoded ahead of time.
 */
const RECORDED: CueId[] = ["three", "two", "one", "go", "stop"];
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<{ buf: AudioBuffer; onsetMs: number } | null>>();

function loadBuffer(lang: Lang, id: CueId) {
  const key = `${lang}/${id}`;
  if (!buffers.has(key)) {
    const p = (async () => {
      if (!ctx || !RECORDED.includes(id)) return null;
      try {
        const res = await fetch(`/audio/${key}.mp3`);
        if (!res.ok) return null;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        // The known Go frame: where the word becomes audible in THIS device's decode.
        return { buf, onsetMs: audibleOnsetMs(buf.getChannelData(0), buf.sampleRate) };
      } catch {
        return null;
      }
    })();
    buffers.set(key, p);
  }
  return buffers.get(key)!;
}

/** Call from a button tap: unlocks speech and Web Audio (iOS) and preloads the cues. */
export function unlockAudio(lang?: Lang): void {
  try {
    const u = new SpeechSynthesisUtterance("");
    window.speechSynthesis?.speak(u);
  } catch {
    /* ignore */
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx ??= new AC();
      void ctx.resume();
      // A silent one-sample buffer started inside the tap fully unlocks iOS.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      if (lang) for (const id of RECORDED) void loadBuffer(lang, id);
    }
  } catch {
    ctx = null;
  }
}

/**
 * Plays a cue; resolves with the time zero to use. For a recorded cue that is
 * the start time + the reported output latency + the audible onset in the
 * file, i.e. when the word is actually heard (see MASTER.md "Cue timing").
 */
export async function playCue(lang: Lang, id: CueId, text: string): Promise<number> {
  if (ctx && ctx.state === "running") {
    const b = await loadBuffer(lang, id);
    if (b) {
      const src = ctx.createBufferSource();
      src.buffer = b.buf;
      src.connect(ctx.destination);
      const startedAt = performance.now();
      src.start();
      lastCueSource = "mp3";
      const latencyMs = ((ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0) * 1000;
      return startedAt + latencyMs + b.onsetMs;
    }
  }
  const audio = await tryAudio(lang, id);
  if (audio) {
    lastCueSource = "mp3";
    audio.currentTime = 0;
    await audio.play().catch(() => undefined);
    return performance.now();
  }
  lastCueSource = "speech";
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

/** Speaks/plays a cue and resolves when it has finished (max `maxMs`). */
export async function playCueAndWait(lang: Lang, id: CueId, text: string, maxMs = 15000): Promise<void> {
  const audio = await tryAudio(lang, id);
  if (audio) {
    audio.currentTime = 0;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.onended = done;
      setTimeout(done, maxMs);
      audio.play().catch(done);
    });
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "es" ? "es-US" : "en-US";
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
      // Rough fallback if onend never fires: ~70 ms per character.
      setTimeout(resolve, Math.min(maxMs, 1500 + text.length * 70));
    } catch {
      resolve();
    }
  });
}
