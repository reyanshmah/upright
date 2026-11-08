/**
 * One Euro filter (Casiez, Roussel, Vogel, CHI 2012).
 * Low jitter when still, low lag when moving fast. Timestamps in seconds.
 */
export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.0, beta: 0.05, dCutoff: 1.0 };

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(private params: OneEuroParams = DEFAULT_ONE_EURO) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x: number, tSeconds: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = tSeconds;
      return x;
    }
    const dt = tSeconds - this.tPrev;
    if (dt <= 0) return this.xPrev;
    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.params.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tSeconds;
    return xHat;
  }
}
