"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findAthleteByEmail } from "@/lib/athletes";
import { ResultError, saveResults, type SaveInput } from "@/lib/results";
import { getSession, SESSION_COOKIE } from "@/lib/session";

export async function signOutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export type SaveSetsResult = { ok: true } | { ok: false; error: string };

/** Saves one exercise's sets for the signed-in athlete (never for an athlete sent by the browser). */
export async function saveSetsAction(input: SaveInput): Promise<SaveSetsResult> {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  if (!athlete || athlete.planType !== "PERSONALIZED") return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };

  try {
    await saveResults(athlete, input);
    return { ok: true };
  } catch (error) {
    if (error instanceof ResultError) return { ok: false, error: error.message };
    // The service account isn't an Editor of the athlete's file (or of a protected tab it writes).
    if ((error as { status?: number }).status === 403) {
      console.error("saveSetsAction: no edit access to the athlete's sheet", { athleteId: athlete.id });
      return { ok: false, error: "La app no tiene permiso para editar tu planilla. Avisale a tu coach." };
    }
    console.error("saveSetsAction failed", { athleteId: athlete.id, error });
    return { ok: false, error: "No pudimos guardar. Revisá tu conexión y probá de nuevo." };
  }
}
