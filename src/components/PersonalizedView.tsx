import type { PersonalizedPlan } from "@/lib/personalized";
import { Chips } from "./Chips";
import { homeHref, prettyLabel } from "./format";
import { WorkoutBlocks } from "./WorkoutBlocks";

export function PersonalizedView({ plan }: { plan: PersonalizedPlan }) {
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
      <WorkoutBlocks blocks={workout.blocks} />
    </>
  );
}

/** Loads/reps are still logged in the athlete's own sheet. */
export function OpenSheetButton({ spreadsheetId }: { spreadsheetId: string }) {
  return (
    <a
      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-white"
    >
      Registrar cargas en mi planilla
    </a>
  );
}
