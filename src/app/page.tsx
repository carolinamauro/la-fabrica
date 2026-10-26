import { AppShell, Message } from "@/components/AppShell";
import { CrossfitScreen } from "@/components/CrossfitScreen";
import { singleParams } from "@/components/format";
import { PersonalizedView } from "@/components/PersonalizedView";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { findAthleteByEmail } from "@/lib/athletes";
import { getPersonalizedPlan } from "@/lib/personalized";
import { getAvailablePlans } from "@/lib/plans";
import { getSavedResults } from "@/lib/results";
import { getSession } from "@/lib/session";

/** The athlete's main plan, the one set in the master ATLETAS tab. */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = singleParams(await searchParams);

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

  if (athlete.planType === "CROSSFIT") {
    return <CrossfitScreen name={athlete.firstName} params={params} path="/" />;
  }

  const [plans, plan] = await Promise.all([
    getAvailablePlans(athlete),
    getPersonalizedPlan(athlete, { week: params.week, day: params.day }),
  ]);
  const saved = plan ? await getSavedResults(athlete, plan.selected) : {};
  return (
    <AppShell name={athlete.firstName} nav={<PlanSwitcher plans={plans} active="PERSONALIZED" />}>
      {plan ? (
        <PersonalizedView plan={plan} saved={saved} />
      ) : (
        <Message title="Tu planificación todavía no está lista">Tu coach la está preparando. Volvé a mirar más tarde.</Message>
      )}
    </AppShell>
  );
}
