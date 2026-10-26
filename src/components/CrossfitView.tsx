import Link from "next/link";
import type { Anexo, CrossfitPlan } from "@/lib/crossfit";
import { Chips } from "./Chips";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { WorkoutBlocks } from "./WorkoutBlocks";

export type CrossfitTab = "entrenamiento" | "anexo";

/** "PLAN DE GIMNASTICOS" → "Gimnásticos". */
function planName(title: string) {
  const name = title.replace(/^PLAN DE\s+/i, "").toLowerCase();
  const pretty = name === "gimnasticos" ? "gimnásticos" : name;
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function CrossfitWorkout({ plan, path = "/" }: { plan: CrossfitPlan; path?: string }) {
  return (
    <>
      <Chips
        label="Días"
        items={plan.days.map((day) => ({
          label: prettyLabel(day),
          href: homeHref({ day }, path),
          active: day === plan.selectedDay,
        }))}
      />
      <DayTitle eyebrow={plan.workout.week && prettyLabel(plan.workout.week)} title={prettyLabel(plan.selectedDay)} />
      <WorkoutBlocks blocks={plan.workout.blocks} />
    </>
  );
}

export function AnexoView({
  anexo,
  planIndex,
  week,
  path = "/",
}: {
  anexo: Anexo;
  planIndex: number;
  week?: string;
  path?: string;
}) {
  const plan = anexo.plans[planIndex] ?? anexo.plans[0];
  if (!plan) return <p className="text-muted">No hay anexo cargado.</p>;
  const selected = plan.weeks.find((w) => w.week === week) ?? plan.weeks[0];
  const index = anexo.plans.indexOf(plan);

  return (
    <>
      <DayTitle eyebrow="Fuerza y técnica" title="Anexo" />
      {anexo.intro.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-muted">
          {anexo.intro.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      <Chips
        label="Planes"
        items={anexo.plans.map((p, i) => ({
          label: planName(p.title),
          href: homeHref({ tab: "anexo", plan: String(i) }, path),
          active: i === index,
        }))}
      />
      {selected ? (
        <>
          <Chips
            label="Semanas"
            items={plan.weeks.map((w) => ({
              label: prettyLabel(w.week),
              href: homeHref({ tab: "anexo", plan: String(index), week: w.week }, path),
              active: w.week === selected.week,
            }))}
          />
          <WorkoutBlocks blocks={selected.blocks.map((b) => ({ ...b, title: prettyLabel(b.title) }))} />
        </>
      ) : (
        <p className="text-muted">Este plan todavía no tiene semanas cargadas.</p>
      )}
    </>
  );
}

export function CrossfitTabs({ active, path = "/" }: { active: CrossfitTab; path?: string }) {
  const tabs: { id: CrossfitTab; label: string; href: string }[] = [
    { id: "entrenamiento", label: "Entrenamiento", href: homeHref({}, path) },
    { id: "anexo", label: "Anexo", href: homeHref({ tab: "anexo" }, path) },
  ];
  return (
    <nav aria-label="Secciones" className="grid grid-cols-2 gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={`flex h-12 items-center justify-center rounded-lg font-display text-lg font-bold tracking-wider uppercase ${
            tab.id === active ? "bg-accent text-background" : "border border-line bg-card text-muted"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
