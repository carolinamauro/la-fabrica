"use client";

import type { CrossfitPlan } from "@/lib/crossfit";
import { crossfitLogKey, loggableItems, type CrossfitLog } from "@/lib/crossfit-log";
import type { Exercise, Workout } from "@/lib/types";
import { Chips } from "./Chips";
import { DaySwipe, useDaySelection } from "./DayNav";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { SetLogger } from "./SetLogger";
import { BACK, FORWARD } from "./transitions";
import { WodLogger } from "./WodLogger";
import { WorkoutBlocks } from "./WorkoutBlocks";

// CrossFit plans are shared, so the calculator starts without an RM and saves none.
export const CROSSFIT_CALCULATOR = { bestLoads: {}, canSave: false };

/**
 * The series logger on each lift and the result logger on each WOD of the day, with what the
 * athlete logged (`log`; undefined when Firestore can't be reached: then nothing can be logged).
 */
function crossfitLoggers(workout: Workout, day: string, log: CrossfitLog | undefined) {
  const items = loggableItems(workout);
  return function CrossfitLogger(exercise: Exercise) {
    const item = items.get(exercise);
    if (!item || !log) return null;
    const saved = log.entries[item.id];
    if (item.kind === "wod") {
      return (
        <WodLogger
          key={`${log.key}-${item.id}`}
          day={day}
          entry={item.id}
          title={item.name}
          saved={saved?.kind === "wod" ? { score: saved.score, rx: saved.rx, note: saved.note } : undefined}
        />
      );
    }
    return (
      <SetLogger
        key={`${log.key}-${item.id}`}
        week={workout.week}
        day={day}
        name={item.exercise}
        setCount={item.sets}
        saved={saved?.kind === "lift" ? saved.sets.map(({ set, load, reps }) => ({ set, load, reps })) : []}
        note={saved?.kind === "lift" ? (saved.note ?? "") : ""}
        crossfit={{ day, entry: item.id }}
        repsHint={item.reps}
      />
    );
  };
}

/**
 * The CrossFit days, switched right on the phone (every day is already loaded). `logs`: what the
 * athlete logged, by log key; null when Firestore can't be reached (then nothing can be logged).
 */
export function CrossfitWorkout({ plan, logs, path = "/" }: { plan: CrossfitPlan; logs: Record<string, CrossfitLog> | null; path?: string }) {
  const [selected, select] = useDaySelection(plan.selectedDay, (day) => homeHref({ day }, path));
  const workout = plan.workouts[selected] ?? plan.workout;
  const at = plan.days.indexOf(selected);
  const previous = at > 0 ? plan.days[at - 1] : undefined;
  const next = at >= 0 && at < plan.days.length - 1 ? plan.days[at + 1] : undefined;
  const key = crossfitLogKey(workout);
  const log = logs ? (logs[key] ?? { key, week: workout.week, day: workout.day, entries: {} }) : undefined;

  return (
    <>
      <Chips
        label="Días"
        items={plan.days.map((day) => ({
          label: prettyLabel(day),
          href: homeHref({ day }, path),
          active: day === selected,
          onSelect: (types) => select(day, types),
        }))}
      />
      <DaySwipe id={selected} onPrevious={previous ? () => select(previous, BACK) : undefined} onNext={next ? () => select(next, FORWARD) : undefined}>
        <div className="flex flex-col gap-4">
          <DayTitle eyebrow={workout.week && prettyLabel(workout.week)} title={prettyLabel(selected)} />
          <WorkoutBlocks blocks={workout.blocks} calculator={CROSSFIT_CALCULATOR} renderExtra={crossfitLoggers(workout, selected, log)} />
        </div>
      </DaySwipe>
    </>
  );
}
