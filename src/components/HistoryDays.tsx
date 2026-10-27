"use client";

import { useState } from "react";
import type { ExerciseHistory, HistoryDay, HistorySet } from "@/lib/history";
import { formatDuration, formatKg, formatLongDate, formatMetric, formatNumber, formatRatio } from "./history-format";
import { ChevronIcon } from "./icons";

// Long histories render a page at a time.
const PAGE = 15;

/** "55 kg × 3", "12 reps", "4:35". */
function setText(set: HistorySet): string {
  if (set.seconds !== undefined) return formatDuration(set.seconds);
  if (set.load !== undefined && set.reps !== undefined) return `${formatKg(set.load)} × ${formatNumber(set.reps, 1)}`;
  if (set.load !== undefined) return formatKg(set.load);
  if (set.reps !== undefined) return `${formatNumber(set.reps, 1)} reps`;
  return "—";
}

// Compared by value: the day's best and its sets arrive from the server as separate objects.
const isBest = (set: HistorySet, day: HistoryDay) => set.at === day.best.at && set.set === day.best.set;

function Day({ day, exercise }: { day: HistoryDay; exercise: ExerciseHistory }) {
  const strength = exercise.metric === "e1rm";
  return (
    <li>
      <details className="group rounded-2xl border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-muted">{formatLongDate(day.date)}</span>
            <span className="block font-display text-2xl leading-tight font-bold tabular-nums">
              {strength ? setText(day.best) : formatMetric(exercise.metric, day.value)}
            </span>
          </span>
          {strength && (
            <span className="shrink-0 text-right leading-tight tabular-nums">
              <span className="block font-display text-lg font-bold text-accent">{formatKg(day.value)}</span>
              <span className="block text-xs text-muted">
                E1RM{day.ratio !== undefined && ` · ${formatRatio(day.ratio)} BW`}
              </span>
            </span>
          )}
          <ChevronIcon className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <ol className="flex flex-col gap-1 border-t border-line px-4 py-3">
          {day.sets.map((set, i) => (
            <li key={i} className={`flex items-baseline gap-3 text-sm tabular-nums ${isBest(set, day) ? "text-foreground" : "text-silver"}`}>
              <span className="w-14 shrink-0 text-xs font-semibold tracking-widest text-muted uppercase">
                {set.set ? `Serie ${set.set}` : "—"}
              </span>
              <span className="flex-1 font-semibold">{setText(set)}</span>
              {set.e1rm !== undefined && <span className="text-muted">E1RM {formatKg(set.e1rm)}</span>}
              {isBest(set, day) && <span className="text-xs font-bold text-accent uppercase">Mejor</span>}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

/** One card per training day, newest first; tap a day for every series logged. */
export function HistoryDays({ exercise }: { exercise: ExerciseHistory }) {
  const [shown, setShown] = useState(PAGE);
  const { days } = exercise;
  return (
    <section aria-label="Registros por día" className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">
        Registros <span className="text-muted">· {days.length} {days.length === 1 ? "día" : "días"}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {days.slice(0, shown).map((day) => (
          <Day key={day.date} day={day} exercise={exercise} />
        ))}
      </ul>
      {shown < days.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="h-12 rounded-lg border border-line font-display font-bold tracking-wider text-muted uppercase"
        >
          Ver más ({days.length - shown})
        </button>
      )}
    </section>
  );
}
