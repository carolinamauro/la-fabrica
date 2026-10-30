"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reloadFromSheetsAction } from "@/app/actions";
import { RefreshIcon } from "./icons";

// How far (px, after resistance) the page has to be pulled down to refresh.
const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Pull down from the top of the page to read the plan from the sheets again. Only in the
 * installed app: in the browser, its own pull-to-refresh reloads the page (KeepFresh handles that).
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [pending, startTransition] = useTransition();
  const start = useRef<number | null>(null);
  const pulled = useRef(0);

  useEffect(() => {
    const standalone =
      matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!standalone) return;

    const onStart = (event: TouchEvent) => {
      // Not while a sheet (timer, picker) is open, nor once the page is scrolled.
      const inDialog = (event.target as Element).closest?.("[role=dialog]");
      start.current = window.scrollY <= 0 && !inDialog ? event.touches[0].clientY : null;
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const distance = event.touches[0].clientY - start.current;
      // Half the finger's travel, so it feels like pulling against something.
      pulled.current = distance > 0 && window.scrollY <= 0 ? Math.min(distance / 2, MAX_PULL) : 0;
      setPull(pulled.current);
    };
    const onEnd = () => {
      if (start.current !== null && pulled.current >= THRESHOLD) {
        startTransition(() => reloadFromSheetsAction());
      }
      start.current = null;
      pulled.current = 0;
      setPull(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!pull && !pending) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div
      role="status"
      aria-label={pending ? "Actualizando" : undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-[env(safe-area-inset-top)]"
      style={{ transform: `translateY(${pending ? 64 : pull}px)`, transition: pull ? "none" : "transform 0.2s" }}
    >
      <span
        className={`grid size-10 place-items-center rounded-full border border-line bg-card-raised shadow-lg ${
          ready || pending ? "text-accent" : "text-muted"
        }`}
      >
        <span className={pending ? "animate-spin" : ""} style={pending ? undefined : { rotate: `${(pull / THRESHOLD) * 270}deg` }}>
          <RefreshIcon className="size-5" />
        </span>
      </span>
    </div>
  );
}
