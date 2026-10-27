"use client";

import { useEffect, type ReactNode } from "react";

/** Panel over the dimmed page (which stays put behind it); tapping the page calls `onDismiss`. */
export function Sheet({ label, onDismiss, className, children }: { label: string; onDismiss: () => void; className: string; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 pt-[calc(env(safe-area-inset-top)+1.5rem)]" onClick={onDismiss}>
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
