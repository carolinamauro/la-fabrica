import { redirect } from "next/navigation";
import { CrossfitScreen } from "@/components/CrossfitScreen";
import { singleParams } from "@/components/format";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { findAthleteByEmail } from "@/lib/athletes";
import { getAvailablePlans } from "@/lib/plans";
import { getSession } from "@/lib/session";

/** The CrossFit plan as an extra, for athletes whose main plan is another one but have the sheet shared. */
export default async function CrossfitPage({ searchParams }: PageProps<"/crossfit">) {
  const params = singleParams(await searchParams);
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  // CrossFit athletes already see it at "/"; others need the sheet shared with them.
  if (!athlete || athlete.planType === "CROSSFIT") redirect("/");

  const plans = await getAvailablePlans(athlete);
  if (!plans.includes("CROSSFIT")) redirect("/");

  return (
    <CrossfitScreen
      name={athlete.firstName}
      params={params}
      path="/crossfit"
      nav={<PlanSwitcher plans={plans} active="CROSSFIT" />}
    />
  );
}
