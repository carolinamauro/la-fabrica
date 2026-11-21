import type { ReactNode } from "react";
import type { Athlete } from "@/lib/athletes";
import { getCrossfitPlan } from "@/lib/crossfit";
import { crossfitLogKey, type CrossfitLog } from "@/lib/crossfit-log";
import { getCrossfitLog } from "@/lib/firestore";
import { AppShell, Message } from "./AppShell";
import { AnexoView, CrossfitTabs, CrossfitWorkout } from "./CrossfitView";

type Params = Record<string, string | undefined>;

/** The shared CrossFit plan (Entrenamiento / Anexo), at "/" for CrossFit athletes or "/crossfit" as an extra plan. */
export async function CrossfitScreen({ athlete, params, path, nav }: { athlete: Athlete; params: Params; path: string; nav?: ReactNode }) {
  const tab = params.tab === "anexo" ? "anexo" : "entrenamiento";
  const plan = await getCrossfitPlan(params.day);
  // What the athlete logged on this day (in Firestore). Without Firestore, the day can't be logged.
  let log: CrossfitLog | undefined;
  if (plan && tab === "entrenamiento") {
    const key = crossfitLogKey(plan.workout);
    const saved = await getCrossfitLog(athlete.id, key);
    log = saved === null ? undefined : (saved ?? { key, week: plan.workout.week, day: plan.workout.day, entries: {} });
  }
  return (
    <AppShell name={athlete.firstName} nav={nav} section={tab} bottom={<CrossfitTabs active={tab} path={path} />}>
      {!plan ? (
        <Message title="Todavía no hay entrenamientos cargados" />
      ) : tab === "anexo" ? (
        <AnexoView anexo={plan.anexo} planIndex={Number(params.plan ?? 0)} week={params.week} path={path} />
      ) : (
        <CrossfitWorkout plan={plan} log={log} path={path} />
      )}
    </AppShell>
  );
}
