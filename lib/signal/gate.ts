/**
 * Time-based hysteresis for live gates, so a gate doesn't flicker when a
 * value hovers near its threshold. Turns ON only after `onMs` of continuous
 * good frames and OFF only after `offMs` of continuous bad frames.
 * Uses timestamps (ms), never frame counts.
 */
export class StableFlag {
  value = false;
  private since: number | null = null;

  constructor(private onMs = 300, private offMs = 600) {}

  update(raw: boolean, tMs: number): boolean {
    if (raw === this.value) {
      this.since = null;
      return this.value;
    }
    this.since ??= tMs;
    if (tMs - this.since >= (raw ? this.onMs : this.offMs)) {
      this.value = raw;
      this.since = null;
    }
    return this.value;
  }

  reset(): void {
    this.value = false;
    this.since = null;
  }
}
