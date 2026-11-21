import Link from "next/link";
import { ViewTransition } from "react";
import type { PlanType } from "@/lib/plans";
import { direction } from "./transitions";

/** A tab of the top navigation: one of the athlete's plans, their Historial or their Logros. */
export type Section = PlanType | "HISTORY" | "ACHIEVEMENTS";

const LABELS: Record<Section, string> = { PERSONALIZED: "Mi plan", CROSSFIT: "CrossFit", HISTORY: "Historial", ACHIEVEMENTS: "Logros" };

/**
 * Tabs between the athlete's main plan ("/"), the CrossFit plan as an extra ("/crossfit") and,
 * for athletes with a file of their own, their Historial ("/historial"). The page slides the way
 * the tabs go, and the underline glides to the new tab. Hidden when there's a single tab.
 */
export function PlanSwitcher({ plans, active, history = false }: { plans: PlanType[]; active: Section; history?: boolean }) {
  const tabs = [
    ...plans.map((plan, i) => ({ section: plan as Section, href: i === 0 ? "/" : "/crossfit" })),
    // Both need the athlete's own file (REGISTRO_PLANIFICACION).
    ...(history
      ? [
          { section: "HISTORY" as const, href: "/historial" },
          { section: "ACHIEVEMENTS" as const, href: "/logros" },
        ]
      : []),
  ];
  if (tabs.length < 2) return null;
  const current = tabs.findIndex((tab) => tab.section === active);
  return (
    <nav aria-label="Secciones" className="flex gap-1 px-4 pb-2">
      {tabs.map(({ section, href }, i) => (
        <Link
          key={section}
          href={href}
          transitionTypes={direction(i, current)}
          aria-current={section === active ? "page" : undefined}
          className={`relative flex h-9 min-w-0 flex-1 items-center justify-center font-display text-base font-bold tracking-wide whitespace-nowrap uppercase transition-colors ${
            section === active ? "text-foreground" : "text-muted active:text-foreground"
          }`}
        >
          {LABELS[section]}
          {section === active && (
            <ViewTransition name="section-tab" share="chip" default="none">
              <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
            </ViewTransition>
          )}
        </Link>
      ))}
    </nav>
  );
}
