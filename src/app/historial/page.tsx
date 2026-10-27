import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell, Message } from "@/components/AppShell";
import { HISTORY_COOKIE } from "@/components/history-format";
import { HistoryView } from "@/components/HistoryView";
import { PlanSwitcher } from "@/components/PlanSwitcher";
import { findAthleteByEmail } from "@/lib/athletes";
import { defaultExercise } from "@/lib/history";
import { getHistory } from "@/lib/history-data";
import { getAvailablePlans } from "@/lib/plans";
import { getSession } from "@/lib/session";

function decode(value: string | undefined): string | undefined {
  try {
    return value && decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The signed-in athlete's performance history (like the HISTORIAL tab, for any exercise). */
export default async function HistoryPage() {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  // Only athletes with a file of their own have a REGISTRO_PLANIFICACION.
  if (!athlete?.spreadsheetId) redirect("/");

  const [plans, history, cookieStore] = await Promise.all([getAvailablePlans(athlete), getHistory(athlete), cookies()]);
  const remembered = cookieStore.get(HISTORY_COOKIE)?.value;
  const initial = history && defaultExercise(history, decode(remembered));

  return (
    <AppShell name={athlete.firstName} nav={<PlanSwitcher plans={plans} active="HISTORY" history />}>
      {history?.length && initial ? (
        <HistoryView history={history} initial={initial} />
      ) : (
        <Message title="Todavía no hay ejercicios en tu historial">
          Tu coach elige qué ejercicios se siguen en la planilla (catálogo de ejercicios).
        </Message>
      )}
    </AppShell>
  );
}
