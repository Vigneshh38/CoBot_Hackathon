"use client";

import { useEffect } from "react";

/** Installs the service worker on page load so the SOS app works offline (push also uses it). */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => { /* offline mode unavailable */ });
  }, []);
  return null;
}
