import type { Athlete } from "./athletes";
import { buildHistory, parseHistoryCatalog, parseHistoryRecords, type ExerciseHistory } from "./history";
import { CATALOG_RANGE, REGISTRO_RANGE } from "./results";
import { readRange } from "./sheets";

// The catalog's TIPO_ATLETA for each plan type (when an exercise is listed twice).
const CATALOG_TYPES: Record<Athlete["planType"], string> = { PERSONALIZED: "FUERZA", CROSSFIT: "CROSSFIT" };

/**
 * The signed-in athlete's history, from their own file's REGISTRO_PLANIFICACION (only their
 * ID_ATLETA rows) and CATALOGO_EJERCICIOS. Null when the athlete has no file of their own.
 * Shares REGISTRO's cache with saving, so a result saved in the app shows up right away.
 */
export async function getHistory(athlete: Athlete): Promise<ExerciseHistory[] | null> {
  if (!athlete.spreadsheetId) return null;
  const [registro, catalog] = await Promise.all([
    readRange(athlete.spreadsheetId, REGISTRO_RANGE),
    readRange(athlete.spreadsheetId, CATALOG_RANGE),
  ]);
  return buildHistory(
    parseHistoryCatalog(catalog, CATALOG_TYPES[athlete.planType]),
    parseHistoryRecords(registro, athlete.id),
    // Like HISTORIAL (DASHBOARD!C9): the athlete's current weight from the master ATLETAS tab.
    athlete.bodyWeightKg,
  );
}
