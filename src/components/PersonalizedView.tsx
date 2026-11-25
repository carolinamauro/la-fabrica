"use client";

import type { PersonalizedPlan } from "@/lib/personalized";
import { resultKey, setCount, type SavedPlan, type SavedResults } from "@/lib/results";
import { sameDayIn } from "@/lib/days";
import { dayKey, type Block, type DaySelection, type WeekSummary } from "@/lib/types";
import { Chips } from "./Chips";
import { DaySwipe, useDaySelection } from "./DayNav";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { BlockRing, DayProgress } from "./ProgressRing";
import { SetLogger } from "./SetLogger";
import { StreakBar, type StreakSummary } from "./StreakBar";
import { BACK, FORWARD } from "./transitions";
import { WorkoutBlocks } from "./WorkoutBlocks";

/** Logged and prescribed series of a block. */
function blockSeries(block: Block, saved: SavedResults) {
  const total = block.exercises.reduce((sum, e) => sum + setCount(e.sets), 0);
  // Extra series beyond the prescribed ones don't push a block past complete.
  const done = block.exercises.reduce((sum, e) => sum + Math.min(saved[resultKey(e.name)]?.length ?? 0, setCount(e.sets)), 0);
  return { done, total };
}

/** "3/8" logged series of the block in a ring that fills, glowing once every prescribed series is in. */
function BlockProgress({ block, saved }: { block: Block; saved: SavedResults }) {
  const { done, total } = blockSeries(block, saved);
  if (!total) return null;
  return <BlockRing done={done} total={total} />;
}

const order = (weeks: WeekSummary[]) => weeks.flatMap((w) => w.days.map((day) => ({ week: w.week, day })));

export function PersonalizedView({ plan, saved, streak }: { plan: PersonalizedPlan; saved: SavedPlan; streak?: StreakSummary | null }) {
  const { weeks, workouts } = plan;
  const [selected, select] = useDaySelection<DaySelection>(plan.selected, (s) => homeHref(s));
  const workout = workouts[dayKey(selected)];
  const savedDay = saved.days[dayKey(selected)] ?? { sets: {}, notes: {} };
  const days = weeks.find((w) => w.week === selected.week)?.days ?? [];

  // Every day in plan order, so a swipe can cross into the next or previous week.
  const sequence = order(weeks);
  const at = sequence.findIndex((s) => s.week === selected.week && s.day === selected.day);
  const previous = at > 0 ? sequence[at - 1] : undefined;
  const next = at >= 0 && at < sequence.length - 1 ? sequence[at + 1] : undefined;
  const indexOf = (s: DaySelection) => sequence.findIndex((d) => d.week === s.week && d.day === s.day);
  const goTo = (target: DaySelection) => select(target, indexOf(target) > at ? FORWARD : BACK);

  if (!workout) return null;
  const series = workout.blocks.map((block) => blockSeries(block, savedDay.sets)).filter(({ total }) => total > 0);
  const progress = {
    done: series.reduce((sum, s) => sum + s.done, 0),
    total: series.reduce((sum, s) => sum + s.total, 0),
    blocksDone: series.filter((s) => s.done >= s.total).length,
    blocks: series.length,
  };

  return (
    <>
      <Chips
        label="Semanas"
        items={weeks.map((w) => {
          const target = sameDayIn(w, selected, weeks);
          return { label: prettyLabel(w.week), href: homeHref(target), active: w.week === selected.week, onSelect: (types) => select(target, types) };
        })}
      />
      <Chips
        label="Días"
        items={days.map((day) => ({
          label: prettyLabel(day),
          href: homeHref({ week: selected.week, day }),
          active: day === selected.day,
          onSelect: (types) => select({ week: selected.week, day }, types),
        }))}
      />
      <DaySwipe
        id={dayKey(selected)}
        onPrevious={previous && (() => goTo(previous))}
        onNext={next && (() => goTo(next))}
      >
        <div className="flex flex-col gap-4">
          <DayTitle eyebrow={prettyLabel(selected.week)} title={prettyLabel(selected.day)} />
          <div className="flex flex-col gap-4 short:grid short:grid-cols-2 short:items-center">
            <DayProgress {...progress} />
            {streak && <StreakBar streak={streak} />}
          </div>
          <WorkoutBlocks
            blocks={workout.blocks}
            renderAside={(block) => <BlockProgress block={block} saved={savedDay.sets} />}
            calculator={{ bestLoads: saved.bestLoads, canSave: true }}
            renderExtra={(exercise) => (
              <SetLogger
                // Remount when the day changes so inputs show that day's values.
                key={`${dayKey(selected)}-${exercise.order}-${exercise.name}`}
                week={selected.week}
                day={selected.day}
                name={exercise.name}
                order={exercise.order}
                setCount={setCount(exercise.sets)}
                rest={exercise.rest}
                saved={savedDay.sets[resultKey(exercise.name)] ?? []}
                note={savedDay.notes[resultKey(exercise.name)]?.note ?? ""}
                previousNote={savedDay.notes[resultKey(exercise.name)]?.previous}
              />
            )}
          />
        </div>
      </DaySwipe>
    </>
  );
}
