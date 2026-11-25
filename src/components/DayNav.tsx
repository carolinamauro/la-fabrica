"use client";

import { animate, motion, useDragControls, useMotionValue } from "motion/react";
import { addTransitionType, startTransition, useState, ViewTransition, type PointerEvent, type ReactNode } from "react";
import { vibrate } from "@/lib/feedback";

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

/**
 * The day shown, switched right on the phone: every day is already loaded, so changing week or day
 * doesn't ask the server again. The URL follows (replaced, not pushed), so a reload or pull to
 * refresh opens the same day.
 */
export function useDaySelection<T>(initial: T, toHref: (selected: T) => string) {
  const [selected, setSelected] = useState(initial);
  function select(next: T, types: readonly string[] = []) {
    startTransition(() => {
      for (const type of types) addTransitionType(type);
      // A day swiped to from the bottom of a long one starts from its top.
      if (window.scrollY > 0) window.scrollTo({ top: 0 });
      setSelected(next);
    });
    window.history.replaceState(null, "", toHref(next));
  }
  return [selected, select] as const;
}

// Dragged sideways this far (px), or flicked this fast (px/s), it moves to the next or previous day.
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 450;
const settle = { type: "spring", stiffness: 500, damping: 40 } as const;

type SwipeProps = { id: string; onPrevious?: () => void; onNext?: () => void; children: ReactNode };

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

function Swipeable({ onPrevious, onNext, children }: Omit<SwipeProps, "id">) {
  const controls = useDragControls();
  const x = useMotionValue(0);

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
      dragElastic={{ left: onNext ? 0.35 : 0.08, right: onPrevious ? 0.35 : 0.08 }}
      onPointerDown={start}
      onDragEnd={(_, info) => {
        const toNext = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;
        const toPrevious = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
        const go = toNext ? onNext : toPrevious ? onPrevious : undefined;
        // Not far enough: back to the center. Far enough: stay where the finger let go.
        if (!go) return void animate(x, 0, settle);
        x.stop();
        vibrate(10);
        go();
      }}
      // Vertical scrolling stays with the browser; sideways moves are the swipe.
      className="touch-pan-y"
    >
      {children}
    </motion.div>
  );
}
