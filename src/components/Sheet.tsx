"use client";

import { animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { useEffect, type ReactNode } from "react";

// Dragged down this far (px), or flicked this fast (px/s), the sheet closes.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 600;

/**
 * Panel over the dimmed page (which stays put behind it). It slides up, and closes (`onDismiss`)
 * when the page is tapped or the panel is dragged down by its top edge.
 */
export function Sheet({ label, onDismiss, className, children }: { label: string; onDismiss: () => void; className: string; children: ReactNode }) {
  const controls = useDragControls();
  // Starts below the screen and springs up; the backdrop follows it (darker as the panel rises).
  const y = useMotionValue(typeof window === "undefined" ? 0 : window.innerHeight);
  const backdrop = useTransform(y, (value) => Math.max(0, 1 - value / 500));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const entering = animate(y, 0, { type: "spring", stiffness: 380, damping: 38 });
    return () => {
      entering.stop();
      document.body.style.overflow = previous;
    };
  }, [y]);

  /** Slides the panel out, then lets the parent unmount it. */
  function dismiss() {
    void animate(y, window.innerHeight, { type: "tween", duration: 0.22, ease: "easeIn" }).then(onDismiss);
  }

  return (
    // overflow-hidden: focusing a field inside never scrolls this frame (which would push the panel off the top).
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+1.5rem)] short:pt-2" onClick={dismiss}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ opacity: backdrop }}
      />
      <motion.div
        role="dialog"
        aria-modal
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={{ y }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) dismiss();
        }}
        className={`relative mx-auto flex w-full max-w-lg flex-1 flex-col short:max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-20px_60px_-20px_rgb(20_210_189/0.18)] ${className}`}
      >
        {/* Grab bar: drag from here to close. */}
        <div
          aria-hidden
          onPointerDown={(e) => controls.start(e)}
          className="absolute inset-x-0 top-0 z-30 flex h-5 cursor-grab touch-none justify-center pt-1.5 active:cursor-grabbing"
        >
          <span className="h-1 w-10 rounded-full bg-muted/40" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
