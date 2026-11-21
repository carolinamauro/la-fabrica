"use client";

import { animate, motion, useDragControls, useMotionValue } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, ViewTransition, type PointerEvent, type ReactNode } from "react";
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
const settle = { type: "spring", stiffness: 500, damping: 40 } as const;

type SwipeProps = { id: string; previous?: string; next?: string; children: ReactNode };

/**
 * The day (`id`), sliding in like `Slide`, that swipes left for the next day and right for the
 * previous one. The content follows the finger with some resistance. Each day gets a fresh,
 * centered surface inside its slide, while the one swiped away leaves from where the finger let go
 * (springing it back to the center first made it jump right before sliding out). The surface sits
 * inside the slide: React only slides a ViewTransition that is itself the part that changed.
 */
export function DaySwipe({ id, ...props }: SwipeProps) {
  return (
    <Slide id={id}>
      <Swipeable {...props} />
    </Slide>
  );
}

function Swipeable({ previous, next, children }: Omit<SwipeProps, "id">) {
  const router = useRouter();
  const controls = useDragControls();
  const x = useMotionValue(0);
  const fallback = useRef<number | undefined>(undefined);

  // Swipes open the neighbouring days sooner.
  useEffect(() => {
    if (previous) router.prefetch(previous);
    if (next) router.prefetch(next);
  }, [router, previous, next]);
  useEffect(() => () => window.clearTimeout(fallback.current), []);

  function start(event: PointerEvent) {
    // Typing, sheets and anything opting out keep their own gestures.
    if ((event.target as Element).closest("input, textarea, select, [role=dialog], [data-no-swipe]")) return;
    controls.start(event);
  }

  return (
    <motion.div
      style={{ x }}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragDirectionLock
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: next ? 0.35 : 0.08, right: previous ? 0.35 : 0.08 }}
      onPointerDown={start}
      onDragEnd={(_, info) => {
        const toNext = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;
        const toPrevious = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
        const href = toNext ? next : toPrevious ? previous : undefined;
        // Not far enough: back to the center. Far enough: stay where the finger let go.
        if (!href) return void animate(x, 0, settle);
        x.stop();
        vibrate(10);
        router.push(href, { transitionTypes: toNext ? FORWARD : BACK });
        // Back to the center if the day never changes (offline, an error).
        fallback.current = window.setTimeout(() => animate(x, 0, settle), 4000);
      }}
      // Vertical scrolling stays with the browser; sideways moves are the swipe.
      className="touch-pan-y"
    >
      {children}
    </motion.div>
  );
}
