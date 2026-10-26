import type { PersonalizedPlan } from "@/lib/personalized";
import { resultKey, setCount, type SavedResults } from "@/lib/results";
import type { Block } from "@/lib/types";
import { Chips } from "./Chips";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { SetLogger } from "./SetLogger";
import { WorkoutBlocks } from "./WorkoutBlocks";

/** "3/8" logged series of the block, solid teal once every prescribed series is in. */
function BlockProgress({ block, saved }: { block: Block; saved: SavedResults }) {
  const total = block.exercises.reduce((sum, e) => sum + setCount(e.sets), 0);
  const done = block.exercises.reduce((sum, e) => sum + (saved[resultKey(e.name)]?.length ?? 0), 0);
  if (!total) return null;
  const complete = done >= total;
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 font-display text-base font-bold tabular-nums ${
        complete ? "bg-accent text-background" : done ? "bg-accent-soft text-accent" : "text-muted"
      }`}
    >
      {complete ? "✓ " : ""}
      {done}/{total}
    </span>
  );
}

export function PersonalizedView({ plan, saved }: { plan: PersonalizedPlan; saved: SavedResults }) {
  const { weeks, selected, workout } = plan;
  const days = weeks.find((w) => w.week === selected.week)?.days ?? [];

  return (
    <>
      <Chips
        label="Semanas"
        items={weeks.map((w) => ({
          label: prettyLabel(w.week),
          href: homeHref({ week: w.week, day: w.days[0] }),
          active: w.week === selected.week,
        }))}
      />
      <Chips
        label="Días"
        items={days.map((day) => ({
          label: prettyLabel(day),
          href: homeHref({ week: selected.week, day }),
          active: day === selected.day,
        }))}
      />
      <DayTitle eyebrow={prettyLabel(selected.week)} title={prettyLabel(selected.day)} />
      <WorkoutBlocks
        blocks={workout.blocks}
        renderAside={(block) => <BlockProgress block={block} saved={saved} />}
        renderExtra={(exercise) => (
          <SetLogger
            // Remount when the day changes so inputs show that day's values.
            key={`${selected.week}-${selected.day}-${exercise.order}-${exercise.name}`}
            week={selected.week}
            day={selected.day}
            name={exercise.name}
            order={exercise.order}
            setCount={setCount(exercise.sets)}
            saved={saved[resultKey(exercise.name)] ?? []}
          />
        )}
      />
    </>
  );
}
