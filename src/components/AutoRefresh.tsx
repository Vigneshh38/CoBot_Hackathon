"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data every few seconds while the tab is visible (live dashboard). */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
