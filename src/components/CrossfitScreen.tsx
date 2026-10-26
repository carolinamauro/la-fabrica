import type { ReactNode } from "react";
import { getCrossfitPlan } from "@/lib/crossfit";
import { AppShell, Message } from "./AppShell";
import { AnexoView, CrossfitTabs, CrossfitWorkout } from "./CrossfitView";

type Params = Record<string, string | undefined>;

/** The shared CrossFit plan (Entrenamiento / Anexo), at "/" for CrossFit athletes or "/crossfit" as an extra plan. */
export async function CrossfitScreen({ name, params, path, nav }: { name: string; params: Params; path: string; nav?: ReactNode }) {
  const tab = params.tab === "anexo" ? "anexo" : "entrenamiento";
  const plan = await getCrossfitPlan(params.day);
  return (
    <AppShell name={name} nav={nav} bottom={<CrossfitTabs active={tab} path={path} />}>
      {!plan ? (
        <Message title="Todavía no hay entrenamientos cargados" />
      ) : tab === "anexo" ? (
        <AnexoView anexo={plan.anexo} planIndex={Number(params.plan ?? 0)} week={params.week} path={path} />
      ) : (
        <CrossfitWorkout plan={plan} path={path} />
      )}
    </AppShell>
  );
}
