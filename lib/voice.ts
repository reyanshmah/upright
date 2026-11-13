"use client";

import type { Lang } from "./i18n";
import { audibleOnsetMs } from "./audioOnset";
import { getVoiceRate } from "./displayPrefs";
import { timeStretch } from "./timeStretch";

/**
 * Voice cues. Recorded EN/ES clips live in public/audio/<lang>/<id>.mp3:
 * 3-2-1, Go and Stop (the "go" cue is time zero), plus the spoken instructions
 * (tugInstr, chairInstr, balIntro) and the short words (hold, good, done).
 * All recorded clips play through Web Audio (unlocked in the Start tap, so
 * they play on iPhone and get the loudness boost). If a clip is missing, the
 * browser's speech reads the same text.
 *
 * Voice speed (Settings) slows the instructions and short words without
 * lowering the pitch. 3-2-1, Go and Stop always play at normal speed so the
 * time zero stays exact.
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
  | "good"
  | "paused";

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

/*
 * Loudness: recorded cues go through a gain stage into a compressor, so they
 * play louder than the file without harsh clipping. Speech (browser voice)
 * can't go above volume 1, so it is set to the maximum.
 */
const CUE_GAIN = 2.5;
let out: AudioNode | null = null;
function output(c: AudioContext): AudioNode {
  if (out && out.context === c) return out;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const gain = c.createGain();
  gain.gain.value = CUE_GAIN;
  gain.connect(comp);
  comp.connect(c.destination);
  out = gain;
  return out;
}
/** Cues whose timing matters: always normal speed. */
const TIMED: CueId[] = RECORDED;
/** Clips preloaded in the Start tap (all recorded files the screens use). */
const PRELOAD: CueId[] = [...RECORDED, "tugInstr", "chairInstr", "balIntro", "hold", "good", "done"];

type Clip = { buf: AudioBuffer; onsetMs: number };

/** Everything playing or being waited on, so stopCues() can silence it at once. */
const activeSources = new Set<AudioBufferSourceNode>();
const waiters = new Set<() => void>();
let activeEl: HTMLAudioElement | null = null;

/**
 * Stop every cue now (recorded clip, file or speech) and release anything
 * waiting for one to finish. Used when the person leaves their position
 * during the instructions or countdown.
 */
export function stopCues(): void {
  for (const s of activeSources) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  activeSources.clear();
  activeEl?.pause();
  activeEl = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no speech */
  }
  for (const w of [...waiters]) w();
  waiters.clear();
}
const buffers = new Map<string, Promise<Clip | null>>();
const slowed = new Map<string, Promise<AudioBuffer | null>>();

function loadBuffer(lang: Lang, id: CueId) {
  const key = `${lang}/${id}`;
  if (!buffers.has(key)) {
    const p = (async () => {
      if (!ctx) return null;
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

/** The clip at the chosen speed (slowed copies are made once and kept). */
function bufferAt(lang: Lang, id: CueId, rate: number): Promise<AudioBuffer | null> {
  if (rate >= 0.999 || TIMED.includes(id)) return loadBuffer(lang, id).then((b) => b?.buf ?? null);
  const key = `${lang}/${id}@${rate}`;
  if (!slowed.has(key)) {
    slowed.set(
      key,
      loadBuffer(lang, id).then(async (b) => {
        if (!b || !ctx) return null;
        await new Promise((r) => setTimeout(r, 0)); // let the page paint first
        const chans = Array.from({ length: b.buf.numberOfChannels }, (_, i) => b.buf.getChannelData(i));
        const outCh = timeStretch(chans, b.buf.sampleRate, rate);
        const out = ctx.createBuffer(outCh.length, outCh[0].length, b.buf.sampleRate);
        outCh.forEach((c, i) => out.copyToChannel(new Float32Array(c), i));
        return out;
      }),
    );
  }
  return slowed.get(key)!;
}

/** Speed for a cue: the setting for instructions/short words, normal for timed cues. */
function rateFor(id: CueId): number {
  return TIMED.includes(id) ? 1 : getVoiceRate();
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
      if (lang) for (const id of PRELOAD) void bufferAt(lang, id, rateFor(id));
    }
  } catch {
    ctx = null;
  }
}

function speak(lang: Lang, text: string, rate: number, onEnd?: () => void): void {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "es" ? "es-US" : "en-US";
  u.rate = 0.95 * rate;
  u.volume = 1;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  synth.speak(u);
}

/**
 * Plays a cue; resolves with the time zero to use. For a recorded cue that is
 * the start time + the reported output latency + the audible onset in the
 * file, i.e. when the word is actually heard (see MASTER.md "Cue timing").
 */
export async function playCue(lang: Lang, id: CueId, text: string): Promise<number> {
  const rate = rateFor(id);
  if (ctx && ctx.state === "running") {
    const [clip, buf] = await Promise.all([loadBuffer(lang, id), bufferAt(lang, id, rate)]);
    if (clip && buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(output(ctx));
      activeSources.add(src);
      src.onended = () => activeSources.delete(src);
      const startedAt = performance.now();
      src.start();
      lastCueSource = "mp3";
      const latencyMs = ((ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0) * 1000;
      return startedAt + latencyMs + clip.onsetMs / rate;
    }
  }
  const audio = await tryAudio(lang, id);
  if (audio) {
    audio.currentTime = 0;
    audio.volume = 1;
    audio.playbackRate = rate;
    const ok = await audio.play().then(() => true, () => false);
    if (ok) {
      lastCueSource = "mp3";
      return performance.now();
    }
  }
  lastCueSource = "speech";
  try {
    speak(lang, text, rate);
  } catch {
    /* no speech available; the on-screen cue still shows */
  }
  return performance.now();
}

/** Speaks/plays a cue and resolves when it has finished (max `maxMs` at normal speed). */
export async function playCueAndWait(lang: Lang, id: CueId, text: string, maxMs = 15000): Promise<void> {
  const rate = rateFor(id);
  const limit = maxMs / rate;
  if (ctx && ctx.state === "running") {
    const buf = await bufferAt(lang, id, rate);
    if (buf) {
      const c = ctx;
      await new Promise<void>((resolve) => {
        const done = () => {
          activeSources.delete(src);
          waiters.delete(done);
          resolve();
        };
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(output(c));
        src.onended = done;
        activeSources.add(src);
        waiters.add(done);
        setTimeout(done, Math.min(limit, buf.duration * 1000 + 1000));
        src.start();
      });
      return;
    }
  }
  const audio = await tryAudio(lang, id);
  if (audio) {
    audio.currentTime = 0;
    audio.volume = 1;
    audio.playbackRate = rate;
    activeEl = audio;
    const played = await new Promise<boolean>((resolve) => {
      const done = () => {
        waiters.delete(done);
        resolve(true);
      };
      waiters.add(done);
      audio.onended = done;
      setTimeout(done, limit);
      audio.play().catch(() => {
        waiters.delete(done);
        resolve(false);
      });
    });
    if (played) return;
  }
  await new Promise<void>((resolve) => {
    const done = () => {
      waiters.delete(done);
      resolve();
    };
    waiters.add(done);
    try {
      speak(lang, text, rate, done);
      // Rough fallback if onend never fires: ~70 ms per character at normal speed.
      setTimeout(done, Math.min(limit, (1500 + text.length * 70) / rate));
    } catch {
      done();
    }
  });
}
