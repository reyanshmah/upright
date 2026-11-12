"use client";

import { useEffect } from "react";
import { BUILD_ID } from "@/lib/version";
import { getThemePref, syncBrowserBar } from "@/lib/themePref";

/** Registers the service worker in production builds only (dev hot reload and caches don't mix). */
export function RegisterSW() {
  // A saved theme (not "auto") also colors the browser bar from the first screen.
  useEffect(() => {
    const pref = getThemePref();
    if (pref !== "auto") syncBrowserBar(pref);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // The build id names the cache, so each deploy starts clean and old caches are removed.
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`).catch(() => {
      /* the app works without it */
    });
  }, []);
  return null;
}
