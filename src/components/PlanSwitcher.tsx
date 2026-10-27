import Link from "next/link";
import type { PlanType } from "@/lib/plans";

/** A tab of the top navigation: one of the athlete's plans, or their Historial. */
export type Section = PlanType | "HISTORY";

const LABELS: Record<Section, string> = { PERSONALIZED: "Mi plan", CROSSFIT: "CrossFit", HISTORY: "Historial" };

/**
 * Tabs between the athlete's main plan ("/"), the CrossFit plan as an extra ("/crossfit") and,
 * for athletes with a file of their own, their Historial ("/historial").
 * Hidden when there's a single tab.
 */
export function PlanSwitcher({ plans, active, history = false }: { plans: PlanType[]; active: Section; history?: boolean }) {
  const tabs = [
    ...plans.map((plan, i) => ({ section: plan as Section, href: i === 0 ? "/" : "/crossfit" })),
    ...(history ? [{ section: "HISTORY" as const, href: "/historial" }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Secciones" className="flex gap-1 px-4 pb-2">
      {tabs.map(({ section, href }) => (
        <Link
          key={section}
          href={href}
          aria-current={section === active ? "page" : undefined}
          className={`flex h-9 flex-1 items-center justify-center border-b-2 font-display text-base font-bold tracking-wider uppercase ${
            section === active ? "border-accent text-foreground" : "border-transparent text-muted"
          }`}
        >
          {LABELS[section]}
        </Link>
      ))}
    </nav>
  );
}
