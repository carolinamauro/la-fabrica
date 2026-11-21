"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

const spring = { type: "spring", stiffness: 120, damping: 20 } as const;

/** A ring that fills as `done` reaches `total`, glowing when complete. */
export function ProgressRing({ done, total, size = 40, stroke = 4, children }: { done: number; total: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const progress = total ? Math.min(done / total, 1) : 0;
  const complete = progress >= 1;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={`absolute inset-0 -rotate-90 ${complete ? "drop-shadow-[0_0_6px_var(--accent)]" : ""}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - progress) }}
          transition={spring}
        />
      </svg>
      {children}
    </span>
  );
}

/** "3/8" logged series of a block, inside a small ring. */
export function BlockRing({ done, total }: { done: number; total: number }) {
  const complete = done >= total;
  return (
    <span aria-label={`${done} de ${total} series`}>
      <ProgressRing done={done} total={total} size={42} stroke={3.5}>
        <span className={`font-display text-xs font-bold tabular-nums ${complete ? "text-accent" : done ? "text-foreground" : "text-muted"}`}>
          {complete ? "✓" : `${done}/${total}`}
        </span>
      </ProgressRing>
    </span>
  );
}

/** The day at a glance: series logged and blocks finished, celebrating when all are in. */
export function DayProgress({ done, total, blocksDone, blocks }: { done: number; total: number; blocksDone: number; blocks: number }) {
  if (!total) return null;
  const complete = done >= total;
  const percent = Math.round((Math.min(done, total) / total) * 100);
  return (
    <motion.section
      aria-label="Progreso del día"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`relative mb-3 flex items-center gap-4 overflow-hidden rounded-2xl border p-3 transition-colors ${
        complete ? "border-accent/60 bg-accent-soft" : "border-line bg-card/70"
      }`}
    >
      {complete && (
        <motion.span
          aria-hidden
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5 }}
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent/15 to-transparent"
        />
      )}
      <ProgressRing done={done} total={total} size={64} stroke={6}>
        <span className="font-display text-lg font-extrabold tabular-nums">{percent}%</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={complete ? "done" : "going"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="font-display text-xl leading-tight font-bold uppercase"
          >
            {complete ? "¡Día completo! 💪" : done ? "Vas bien, seguí así" : "Arrancá cuando quieras"}
          </motion.p>
        </AnimatePresence>
        <p className="mt-0.5 text-sm text-muted tabular-nums">
          <span className="font-semibold text-foreground">{Math.min(done, total)}</span> de {total} series · {blocksDone}/{blocks} bloques
        </p>
      </div>
    </motion.section>
  );
}
