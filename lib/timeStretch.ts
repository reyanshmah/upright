/**
 * Slows recorded speech without lowering its pitch (WSOLA: overlap-add of
 * short windows, each nudged to line up with the previous one so the voice
 * stays smooth). Used for the "Voice speed" accessibility setting.
 *
 * Pure: takes channel samples, returns new channel samples. `rate` < 1 slows
 * down (0.5 = half speed, twice as long); 1 returns the input unchanged.
 */

/** Window length (s): about two voice periods of low speech, short enough for crisp consonants. */
const FRAME_S = 0.04;
/** How far (s) each window may shift to line up with the previous one. */
const SEARCH_S = 0.01;
/** Search and correlation strides (samples), to keep this quick on a phone. */
const SEARCH_STEP = 3;
const CORR_STEP = 6;

export function timeStretch(channels: Float32Array[], sampleRate: number, rate: number): Float32Array[] {
  if (!(rate > 0) || rate >= 0.999 || !channels.length) return channels;
  const x = channels[0];
  const len = x.length;
  const N = Math.max(4, Math.round(sampleRate * FRAME_S) & ~1);
  const Hs = N >> 1; // output hop: 50% overlap
  const Ha = Hs * rate; // input hop
  const tol = Math.round(sampleRate * SEARCH_S);
  const outLen = Math.ceil(len / rate);
  const out = channels.map(() => new Float32Array(outLen + N));

  // Periodic Hann: windows at 50% overlap sum to exactly 1.
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);

  let prev = 0;
  for (let k = 0, outPos = 0; ; k++, outPos += Hs) {
    const nominal = Math.round(k * Ha);
    if (nominal >= len || outPos >= outLen) break;
    let best = nominal;
    if (k > 0) {
      // Pick the shift whose start best matches the natural continuation of the previous window.
      const tmpl = prev + Hs;
      let bestC = -Infinity;
      for (let d = -tol; d <= tol; d += SEARCH_STEP) {
        const p = nominal + d;
        if (p < 0 || p + N > len) continue;
        let c = 0;
        for (let i = 0; i < N && tmpl + i < len; i += CORR_STEP) c += x[p + i] * x[tmpl + i];
        if (c > bestC) {
          bestC = c;
          best = p;
        }
      }
    }
    for (let j = 0; j < channels.length; j++) {
      const src = channels[j], dst = out[j];
      for (let i = 0; i < N; i++) {
        const s = best + i;
        if (s >= len) break;
        dst[outPos + i] += win[i] * src[s];
      }
    }
    prev = best;
  }
  return out.map((c) => c.subarray(0, outLen));
}
