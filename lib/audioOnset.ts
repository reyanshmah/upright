/**
 * Where a cue becomes audible inside its decoded audio, so time zero can be
 * the moment the word is heard, not the moment the file starts. Measured on
 * the device from the decoded buffer, which also absorbs MP3 decoder padding
 * (about 13 ms more on Apple's decoder than on Chrome's).
 */

/** Audible = 5 ms RMS within this many dB of the cue's loudest 5 ms. */
export const ONSET_REL_DB = 20;
const WIN_S = 0.005;
const HOP_S = 0.001;

/** Milliseconds from the first sample to the audible onset (0 if never audible). */
export function audibleOnsetMs(samples: Float32Array, sampleRate: number): number {
  const win = Math.max(1, Math.round(WIN_S * sampleRate));
  const hop = Math.max(1, Math.round(HOP_S * sampleRate));
  const db: number[] = [];
  for (let i = 0; i + win <= samples.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j];
    db.push(10 * Math.log10(sum / win + 1e-18));
  }
  if (!db.length) return 0;
  const thr = Math.max(...db) - ONSET_REL_DB;
  const first = db.findIndex((v) => v > thr);
  return first < 0 ? 0 : (first * hop * 1000) / sampleRate;
}
