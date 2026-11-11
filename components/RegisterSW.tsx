"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (dev hot reload and caches don't mix). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* the app works without it */
    });
  }, []);
  return null;
}
