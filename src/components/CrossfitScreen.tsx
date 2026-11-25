import type { ReactNode } from "react";
import type { Athlete } from "@/lib/athletes";
import { getCrossfitPlan } from "@/lib/crossfit";
import type { CrossfitLog } from "@/lib/crossfit-log";
import { listCrossfitLogs } from "@/lib/firestore";
import { AppShell, Message } from "./AppShell";
import { CrossfitWorkout } from "./CrossfitDays";
import { AnexoView, CrossfitTabs } from "./CrossfitView";

type Params = Record<string, string | undefined>;

/** The shared CrossFit plan (Entrenamiento / Anexo), at "/" for CrossFit athletes or "/crossfit" as an extra plan. */
export async function CrossfitScreen({ athlete, params, path, nav }: { athlete: Athlete; params: Params; path: string; nav?: ReactNode }) {
  const tab = params.tab === "anexo" ? "anexo" : "entrenamiento";
  const plan = await getCrossfitPlan(params.day);
  // What the athlete logged on every day (in Firestore), so switching days needs no new load.
  // Without Firestore, the days can't be logged.
  let logs: Record<string, CrossfitLog> | null = null;
  if (plan && tab === "entrenamiento") {
    const all = await listCrossfitLogs(athlete.id);
    logs = all && Object.fromEntries(all.map((log) => [log.key, log]));
  }
  return (
    <AppShell name={athlete.firstName} nav={nav} section={tab} bottom={<CrossfitTabs active={tab} path={path} />}>
      {!plan ? (
        <Message title="Todavía no hay entrenamientos cargados" />
      ) : tab === "anexo" ? (
        <AnexoView anexo={plan.anexo} planIndex={Number(params.plan ?? 0)} week={params.week} path={path} />
      ) : (
        <CrossfitWorkout plan={plan} logs={logs} path={path} />
      )}
    </AppShell>
  );
}
