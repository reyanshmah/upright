/**
 * Keeps the screen on while the camera runs. A phone that dims and locks
 * mid-test hides the tab, and a hidden tab refuses the run, so without this a
 * slow TUG on a phone with a 30 s auto-lock could never finish. Best effort:
 * browsers without the Wake Lock API just skip it.
 */
type Sentinel = { release: () => Promise<void>; released?: boolean };

let sentinel: Sentinel | null = null;
let wanted = false;

async function acquire() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
    if (!wl || document.visibilityState !== "visible") return;
    sentinel = await wl.request("screen");
  } catch {
    sentinel = null; /* low battery mode, or not allowed */
  }
}

function onVisible() {
  // The browser drops the lock when the page is hidden; take it back on return.
  if (wanted && document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
}

export function keepScreenOn(on: boolean): void {
  if (typeof document === "undefined") return;
  wanted = on;
  if (on) {
    document.addEventListener("visibilitychange", onVisible);
    if (!sentinel || sentinel.released) void acquire();
  } else {
    document.removeEventListener("visibilitychange", onVisible);
    void sentinel?.release().catch(() => {});
    sentinel = null;
  }
}
