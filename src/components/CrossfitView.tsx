import Link from "next/link";
import { ViewTransition } from "react";
import type { Anexo } from "@/lib/crossfit";
import { Chips } from "./Chips";
import { Slide } from "./DayNav";
import { DayTitle } from "./DayTitle";
import { homeHref, prettyLabel } from "./format";
import { direction } from "./transitions";
import { WorkoutBlocks } from "./WorkoutBlocks";

import { CROSSFIT_CALCULATOR } from "./CrossfitDays";

export type CrossfitTab = "entrenamiento" | "anexo";

/** "PLAN DE GIMNASTICOS" → "Gimnásticos". */
function planName(title: string) {
  const name = title.replace(/^PLAN DE\s+/i, "").toLowerCase();
  const pretty = name === "gimnasticos" ? "gimnásticos" : name;
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
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
          <Slide id={`${index}-${selected.week}`}>
            <WorkoutBlocks blocks={selected.blocks.map((b) => ({ ...b, title: prettyLabel(b.title) }))} calculator={CROSSFIT_CALCULATOR} />
          </Slide>
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
  const current = tabs.findIndex((tab) => tab.id === active);
  // A segmented control: the teal pill glides to the tab picked, and the page slides that way.
  return (
    <nav aria-label="Secciones" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card/70 p-1">
      {tabs.map((tab, i) => (
        <Link
          key={tab.id}
          href={tab.href}
          transitionTypes={direction(i, current)}
          aria-current={tab.id === active ? "page" : undefined}
          className={`relative flex h-11 items-center justify-center rounded-xl font-display text-lg font-bold tracking-wider uppercase transition-colors ${
            tab.id === active ? "text-background" : "text-muted active:text-foreground"
          }`}
        >
          {tab.id === active && (
            <ViewTransition name="crossfit-tab" share="chip" default="none">
              <span aria-hidden className="absolute inset-0 rounded-xl bg-accent shadow-[0_6px_20px_-8px_var(--accent)]" />
            </ViewTransition>
          )}
          <span className="relative">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
