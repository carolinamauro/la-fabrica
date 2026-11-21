"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { beep, setSound, useSound, vibrate } from "@/lib/feedback";
import { formatClock } from "@/lib/timer";
import { useWakeLock } from "./Timer";

export type Rest = { id: number; seconds: number; label: string };

const RING = 2 * Math.PI * 20;

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 5 6M22 9l-5 6" />}
    </svg>
  );
}

/**
 * The rest between series, started on its own when a series is checked: a pill docked at the
 * bottom with a countdown ring, +15 s and skip. Beeps the last 3 seconds and vibrates at 0.
 */
function RestPill({ rest, onDone }: { rest: Rest; onDone: () => void }) {
  const sound = useSound();
  const [end, setEnd] = useState(() => Date.now() + rest.seconds * 1000);
  const [total, setTotal] = useState(rest.seconds);
  const [now, setNow] = useState(() => Date.now());
  const lastBeep = useRef<number | null>(null);
  useWakeLock(true);

  const left = Math.max(0, Math.ceil((end - now) / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left === lastBeep.current) return;
    lastBeep.current = left;
    if (left > 0 && left <= 3) {
      if (sound) beep(660, 0.12);
    } else if (left === 0) {
      if (sound) beep(990, 0.5);
      vibrate([200, 100, 200]);
      const id = setTimeout(onDone, 1200);
      return () => clearTimeout(id);
    }
  }, [left, sound, onDone]);

  const progress = total ? left / total : 0;
  const finished = left === 0;

  return (
    <motion.div
      data-timer-dock
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="fixed inset-x-0 bottom-[calc(var(--dock)+env(safe-area-inset-bottom))] z-40 px-4 pb-3"
    >
      <div
        role="timer"
        aria-label={`Descanso ${rest.label}`}
        className={`mx-auto flex max-w-lg items-center gap-3 rounded-2xl border p-2 pr-3 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.8)] backdrop-blur-xl transition-colors ${
          finished ? "border-accent bg-accent/25" : "border-accent/30 bg-card/85"
        }`}
      >
        <div className="relative grid size-12 shrink-0 place-items-center">
          <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="4" />
            <motion.circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING}
              animate={{ strokeDashoffset: RING * (1 - progress) }}
              transition={{ duration: 0.3, ease: "linear" }}
            />
          </svg>
          <span className="font-display text-xs font-bold tracking-wider text-accent uppercase">{finished ? "¡Ya!" : "Pausa"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold tracking-widest text-muted uppercase">{finished ? "A la próxima serie" : rest.label}</p>
          <p className="font-display text-3xl leading-none font-extrabold tabular-nums">{formatClock(left)}</p>
        </div>
        <button
          type="button"
          aria-label={sound ? "Silenciar" : "Activar sonido"}
          onClick={() => setSound(!sound)}
          className={`grid size-10 place-items-center rounded-xl ${sound ? "text-silver" : "text-muted"}`}
        >
          <SoundIcon on={sound} />
        </button>
        <button
          type="button"
          onClick={() => {
            setEnd((e) => Math.max(e, Date.now()) + 15000);
            setTotal((t) => t + 15);
          }}
          className="h-10 rounded-xl bg-card-raised px-3 font-display font-bold tracking-wider text-foreground tabular-nums active:bg-line"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-xl bg-accent px-3 font-display font-extrabold tracking-wider text-background uppercase active:opacity-80"
        >
          {finished ? "OK" : "Saltar"}
        </button>
      </div>
    </motion.div>
  );
}

export function RestTimer({ rest, onDone }: { rest: Rest | null; onDone: () => void }) {
  return <AnimatePresence>{rest && <RestPill key={rest.id} rest={rest} onDone={onDone} />}</AnimatePresence>;
}
