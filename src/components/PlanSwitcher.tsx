import Link from "next/link";
import type { PlanType } from "@/lib/plans";

const LABELS: Record<PlanType, string> = { PERSONALIZED: "Mi plan", CROSSFIT: "CrossFit" };

/**
 * Tabs between the athlete's main plan ("/") and the CrossFit plan as an extra ("/crossfit").
 * Hidden when the athlete has a single plan.
 */
export function PlanSwitcher({ plans, active }: { plans: PlanType[]; active: PlanType }) {
  if (plans.length < 2) return null;
  return (
    <nav aria-label="Planes" className="flex gap-1 px-4 pb-2">
      {plans.map((plan, i) => (
        <Link
          key={plan}
          href={i === 0 ? "/" : "/crossfit"}
          aria-current={plan === active ? "page" : undefined}
          className={`flex h-9 flex-1 items-center justify-center border-b-2 font-display text-base font-bold tracking-wider uppercase ${
            plan === active ? "border-accent text-foreground" : "border-transparent text-muted"
          }`}
        >
          {LABELS[plan]}
        </Link>
      ))}
    </nav>
  );
}
