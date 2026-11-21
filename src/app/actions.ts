"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findAthleteByEmail } from "@/lib/athletes";
import { saveGoals } from "@/lib/firestore";
import { MAX_LIFT_GOALS, type Goals } from "@/lib/goals";
import { ResultError, saveResults, saveRm, type PersonalRecord, type SaveInput } from "@/lib/results";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { clearSheetCache } from "@/lib/sheets";

export async function signOutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Pull to refresh: reads the plan from the sheets again instead of the cached copy, and re-renders. */
export async function reloadFromSheetsAction() {
  if (!(await getSession())) redirect("/login");
  clearSheetCache();
  refresh();
}

/** `record`: the save beat the athlete's best for that exercise (the app celebrates it). */
export type SaveSetsResult = { ok: true; record?: PersonalRecord } | { ok: false; error: string };

/** Saves one exercise's sets for the signed-in athlete (never for an athlete sent by the browser). */
export async function saveSetsAction(input: SaveInput): Promise<SaveSetsResult> {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  if (!athlete || athlete.planType !== "PERSONALIZED") return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };

  try {
    const { record } = await saveResults(athlete, input);
    return { ok: true, record };
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

/** Saves an RM typed in the load calculator (only when it beats the athlete's best load). */
export async function saveRmAction(input: { name: string; rm: number }): Promise<SaveSetsResult> {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  if (!athlete || athlete.planType !== "PERSONALIZED") return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };

  try {
    await saveRm(athlete, input);
    return { ok: true };
  } catch (error) {
    if (error instanceof ResultError) return { ok: false, error: error.message };
    console.error("saveRmAction failed", { athleteId: athlete.id, error });
    return { ok: false, error: "No pudimos guardar tu RM. Revisá tu conexión y probá de nuevo." };
  }
}

/** Saves the signed-in athlete's goals: training days per week and target loads. */
export async function saveGoalsAction(input: Goals): Promise<SaveSetsResult> {
  const session = await getSession();
  const athlete = session ? await findAthleteByEmail(session.email) : null;
  if (!athlete) return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };

  const weeklyDays = Number(input?.weeklyDays);
  const lifts = Array.isArray(input?.lifts) ? input.lifts : [];
  if (!Number.isInteger(weeklyDays) || weeklyDays < 1 || weeklyDays > 7) return { ok: false, error: "Elegí entre 1 y 7 días por semana." };
  if (lifts.length > MAX_LIFT_GOALS) return { ok: false, error: `Podés tener hasta ${MAX_LIFT_GOALS} objetivos de carga.` };
  const clean = [];
  for (const lift of lifts) {
    const exercise = String(lift?.exercise ?? "").trim().toUpperCase().replace(/\s+/g, " ").slice(0, 80);
    const targetKg = Number(lift?.targetKg);
    if (!exercise || !Number.isFinite(targetKg) || targetKg <= 0 || targetKg > 500) {
      return { ok: false, error: "Revisá los objetivos de carga: usá kilos entre 1 y 500." };
    }
    clean.push({ exercise, targetKg: Math.round(targetKg * 10) / 10 });
  }

  try {
    await saveGoals(athlete.id, { weeklyDays, lifts: clean });
    return { ok: true };
  } catch (error) {
    console.error("saveGoalsAction failed", { athleteId: athlete.id, error });
    return { ok: false, error: "No pudimos guardar tus objetivos. Probá de nuevo en un rato." };
  }
}
