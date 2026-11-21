import Link from "next/link";

export type StreakSummary = { weeks: number; days: number; goal: number; weekdays: number[]; newBadges: number };

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** The week at a glance on the day screen: streak, days trained against the goal; opens Logros. */
export function StreakBar({ streak }: { streak: StreakSummary }) {
  const { weeks, days, goal, weekdays, newBadges } = streak;
  return (
    <Link
      href="/logros"
      className="group flex items-center gap-3 rounded-2xl border border-line bg-card/70 px-3 py-2 transition-colors active:border-accent/60"
      aria-label={`Racha de ${weeks} semanas, ${days} de ${goal} días esta semana. Ver logros`}
    >
      <span className="flex items-center gap-1 font-display text-xl font-extrabold tabular-nums">
        <span aria-hidden>{weeks ? "🔥" : "🌱"}</span>
        {weeks}
        <span className="text-xs font-bold tracking-wider text-muted uppercase">sem</span>
      </span>
      <span className="h-6 w-px bg-line" aria-hidden />
      <span className="flex flex-1 items-center gap-1" aria-hidden>
        {WEEKDAYS.map((label, i) => (
          <span
            key={i}
            className={`grid size-5 place-items-center rounded-full text-[0.6rem] font-bold ${
              weekdays.includes(i) ? "bg-accent text-background" : "border border-line text-muted"
            }`}
          >
            {label}
          </span>
        ))}
      </span>
      <span className={`font-display text-sm font-bold tabular-nums ${days >= goal ? "text-accent" : "text-muted"}`}>
        {days}/{goal}
      </span>
      {newBadges > 0 && (
        <span className="relative flex size-2.5" aria-label="Insignia nueva">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
      )}
    </Link>
  );
}
