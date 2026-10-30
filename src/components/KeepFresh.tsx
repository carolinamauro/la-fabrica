"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { reloadFromSheetsAction } from "@/app/actions";

// Back from the background after this long, the page re-renders with the plan as it is now.
const STALE_AFTER_MS = 5 * 60_000;

// A browser reload is checked once per page load, not on every page the athlete opens after it.
let reloadChecked = false;

/**
 * Keeps an app left open in the background from coming back stale or blank (iOS can resume a
 * home-screen app from a frozen snapshot), and makes a browser reload read the sheets again.
 */
export function KeepFresh() {
  const router = useRouter();

  useEffect(() => {
    if (!reloadChecked) {
      reloadChecked = true;
      const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (entry?.type === "reload") void reloadFromSheetsAction();
    }

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) router.refresh();
    };
    // Restored from the back/forward cache: its React state can be out of sync, so load it again.
    const onPageShow = (event: PageTransitionEvent) => event.persisted && location.reload();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
