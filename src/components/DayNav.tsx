"use client";

import { motion, useDragControls } from "motion/react";
import { useRouter } from "next/navigation";
import { ViewTransition, type PointerEvent, type ReactNode } from "react";
import { vibrate } from "@/lib/feedback";
import { BACK, FORWARD } from "./transitions";

const slide = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * Content that slides left or right when it changes (keyed by `id`), the way the navigation went.
 * Other updates (a refresh, a saved series) don't animate.
 */
export function Slide({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <ViewTransition key={id} enter={slide} exit={slide} default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}

// Dragged sideways this far (px), or flicked this fast (px/s), it moves to the next or previous day.
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 450;

/**
 * Swipe left for the next day, right for the previous one. The content follows the finger with
 * some resistance, and the day's own slide plays once it changes.
 */
export function DaySwipe({ previous, next, children }: { previous?: string; next?: string; children: ReactNode }) {
  const router = useRouter();
  const controls = useDragControls();

  function start(event: PointerEvent) {
    // Typing, sheets and anything opting out keep their own gestures.
    if ((event.target as Element).closest("input, textarea, select, [role=dialog], [data-no-swipe]")) return;
    controls.start(event);
  }

  return (
    <motion.div
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragDirectionLock
      dragSnapToOrigin
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: next ? 0.35 : 0.08, right: previous ? 0.35 : 0.08 }}
      onPointerDown={start}
      onDragEnd={(_, info) => {
        const toNext = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;
        const toPrevious = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
        const href = toNext ? next : toPrevious ? previous : undefined;
        if (!href) return;
        vibrate(10);
        router.push(href, { transitionTypes: toNext ? FORWARD : BACK });
      }}
      // Vertical scrolling stays with the browser; sideways moves are the swipe.
      className="touch-pan-y"
    >
      {children}
    </motion.div>
  );
}
