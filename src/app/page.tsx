import { AppShell, Message } from "@/components/AppShell";
import { AnexoView, CrossfitTabs, CrossfitWorkout } from "@/components/CrossfitView";
import { OpenSheetButton, PersonalizedView } from "@/components/PersonalizedView";
import { findAthleteByEmail } from "@/lib/athletes";
import { getCrossfitPlan } from "@/lib/crossfit";
import { getPersonalizedPlan } from "@/lib/personalized";
import { getSession } from "@/lib/session";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);

  // Re-checked on every visit: if the coach deactivates an athlete, access stops right away.
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;

  if (!athlete) {
    return (
      <AppShell>
        <Message title="Tu cuenta no está activa">Pedile a tu coach que revise tu email en la lista de atletas.</Message>
      </AppShell>
    );
  }

  if (athlete.planType === "PERSONALIZED") {
    const plan = await getPersonalizedPlan(athlete, { week: param("week"), day: param("day") });
    return (
      <AppShell
        name={athlete.firstName}
        bottom={athlete.spreadsheetId && <OpenSheetButton spreadsheetId={athlete.spreadsheetId} />}
      >
        {plan ? (
          <PersonalizedView plan={plan} />
        ) : (
          <Message title="Tu planificación todavía no está lista">Tu coach la está preparando. Volvé a mirar más tarde.</Message>
        )}
      </AppShell>
    );
  }

  const tab = param("tab") === "anexo" ? "anexo" : "entrenamiento";
  const plan = await getCrossfitPlan(param("day"));
  return (
    <AppShell name={athlete.firstName} bottom={<CrossfitTabs active={tab} />}>
      {!plan ? (
        <Message title="Todavía no hay entrenamientos cargados" />
      ) : tab === "anexo" ? (
        <AnexoView anexo={plan.anexo} planIndex={Number(param("plan") ?? 0)} week={param("week")} />
      ) : (
        <CrossfitWorkout plan={plan} />
      )}
    </AppShell>
  );
}
