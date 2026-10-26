import { AppShell } from "@/components/AppShell";
import { DayTitle } from "@/components/DayTitle";
import { singleParams } from "@/components/format";
import { Timer } from "@/components/Timer";
import { timerFromParams } from "@/lib/timer";

/** Box clock (AMRAP, EMOM, For Time, Tabata). Opened from the header, or set up from a workout line. */
export default async function TimerPage({ searchParams }: PageProps<"/timer">) {
  const initial = timerFromParams(singleParams(await searchParams));
  return (
    <AppShell>
      <DayTitle eyebrow="Reloj" title="Timer" />
      {/* Remount when a different workout line opens the timer. */}
      <Timer key={JSON.stringify(initial)} initial={initial} />
    </AppShell>
  );
}
