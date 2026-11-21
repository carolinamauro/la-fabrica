import { redirect } from "next/navigation";
import { AchievementsView } from "@/components/AchievementsView";
import { AppShell } from "@/components/AppShell";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { findAthleteByEmail } from "@/lib/athletes";
import { getAchievements } from "@/lib/achievements-data";
import { getAvailablePlans } from "@/lib/plans";
import { getSession } from "@/lib/session";

/** The athlete's streak, goals, badges and PRs (from their REGISTRO, plus goals in Firestore). */
export default async function AchievementsPage() {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  // Only athletes with a file of their own log results.
  if (!athlete?.spreadsheetId) redirect("/");

  const [plans, data] = await Promise.all([getAvailablePlans(athlete), getAchievements(athlete)]);
  if (!data) redirect("/");

  return (
    <AppShell name={athlete.firstName} nav={<PlanSwitcher plans={plans} active="ACHIEVEMENTS" history />}>
      <AchievementsView data={data} />
    </AppShell>
  );
}
