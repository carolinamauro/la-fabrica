import type { PersonalizedPlan } from "@/lib/personalized";
import { resultKey, setCount, type SavedDay, type SavedResults } from "@/lib/results";
import type { Block } from "@/lib/types";
import { Chips } from "./Chips";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { DaySwipe, Slide } from "./DayNav";
import { BlockRing, DayProgress } from "./ProgressRing";
import { SetLogger } from "./SetLogger";
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

export function PersonalizedView({ plan, saved }: { plan: PersonalizedPlan; saved: SavedDay }) {
  const { weeks, selected, workout } = plan;
  const days = weeks.find((w) => w.week === selected.week)?.days ?? [];
  const series = workout.blocks.map((block) => blockSeries(block, saved.sets)).filter(({ total }) => total > 0);
  const day = {
    done: series.reduce((sum, s) => sum + s.done, 0),
    total: series.reduce((sum, s) => sum + s.total, 0),
    blocksDone: series.filter((s) => s.done >= s.total).length,
    blocks: series.length,
  };
  // Every day in plan order, so a swipe can cross into the next or previous week.
  const sequence = weeks.flatMap((w) => w.days.map((d) => ({ week: w.week, day: d })));
  const at = sequence.findIndex((s) => s.week === selected.week && s.day === selected.day);
  const previous = at > 0 ? sequence[at - 1] : undefined;
  const next = at >= 0 && at < sequence.length - 1 ? sequence[at + 1] : undefined;

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
      <DaySwipe previous={previous && homeHref(previous)} next={next && homeHref(next)}>
        <Slide id={`${selected.week}-${selected.day}`}>
          <div className="flex flex-col gap-4">
            <DayTitle eyebrow={prettyLabel(selected.week)} title={prettyLabel(selected.day)} />
            <DayProgress {...day} />
            <WorkoutBlocks
              blocks={workout.blocks}
              renderAside={(block) => <BlockProgress block={block} saved={saved.sets} />}
              calculator={{ bestLoads: saved.bestLoads, canSave: true }}
              renderExtra={(exercise) => (
                <SetLogger
                  // Remount when the day changes so inputs show that day's values.
                  key={`${selected.week}-${selected.day}-${exercise.order}-${exercise.name}`}
                  week={selected.week}
                  day={selected.day}
                  name={exercise.name}
                  order={exercise.order}
                  setCount={setCount(exercise.sets)}
                  rest={exercise.rest}
                  saved={saved.sets[resultKey(exercise.name)] ?? []}
                  note={saved.notes[resultKey(exercise.name)]?.note ?? ""}
                  previousNote={saved.notes[resultKey(exercise.name)]?.previous}
                />
              )}
            />
          </div>
        </Slide>
      </DaySwipe>
    </>
  );
}
