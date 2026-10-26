import type { PersonalizedPlan } from "@/lib/personalized";
import { resultKey, setCount, type SavedResults } from "@/lib/results";
import { Chips } from "./Chips";
import { homeHref, prettyLabel } from "./format";
import { SetLogger } from "./SetLogger";
import { WorkoutBlocks } from "./WorkoutBlocks";

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
      <h1 className="text-2xl font-bold">
        {prettyLabel(selected.week)} · {prettyLabel(selected.day)}
      </h1>
      <WorkoutBlocks
        blocks={workout.blocks}
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
