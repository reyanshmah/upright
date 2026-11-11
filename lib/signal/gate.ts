import type { GateEvent } from "../contract";

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

/**
 * Records gate TRANSITIONS (plus each gate's first state) so a finished test
 * carries proof of which gates held and when.
 */
export class GateLogger {
  private last = new Map<GateEvent["gate"], boolean>();
  events: GateEvent[] = [];

  update(gate: GateEvent["gate"], ok: boolean, tMs: number): void {
    if (this.last.get(gate) === ok) return;
    this.last.set(gate, ok);
    this.events.push({ t: tMs, gate, ok });
  }

  reset(): void {
    this.last.clear();
    this.events = [];
  }

  /** Events with time re-based to the Go cue (t - goT). */
  relativeTo(goT: number): GateEvent[] {
    return this.events.map((e) => ({ ...e, t: e.t - goT }));
  }
}

/**
 * Total ms a gate was OFF inside [fromMs, toMs]. A gate with no event before
 * the window is assumed ON until its first event (a gate that never logged
 * was never evaluated, so it cannot refuse a test).
 */
export function gateOffMs(log: GateEvent[], gate: GateEvent["gate"], fromMs: number, toMs: number): number {
  const ev = log.filter((e) => e.gate === gate).sort((a, b) => a.t - b.t);
  let state = true;
  for (const e of ev) if (e.t <= fromMs) state = e.ok;
  let cursor = fromMs;
  let off = 0;
  for (const e of ev) {
    if (e.t <= fromMs || e.t >= toMs) continue;
    if (!state) off += e.t - cursor;
    cursor = e.t;
    state = e.ok;
  }
  if (!state) off += toMs - cursor;
  return off;
}
