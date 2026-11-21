import type { Athlete } from "./athletes";
import { crossfitCatalog, crossfitRecords } from "./crossfit-log";
import { listCrossfitLogs } from "./firestore";
import { buildHistory, parseHistoryCatalog, parseHistoryRecords, type ExerciseHistory, type HistoryRecord } from "./history";
import { CATALOG_RANGE, REGISTRO_RANGE } from "./results";
import { readRange } from "./sheets";

// The catalog's TIPO_ATLETA for each plan type (when an exercise is listed twice).
const CATALOG_TYPES: Record<Athlete["planType"], string> = { PERSONALIZED: "FUERZA", CROSSFIT: "CROSSFIT" };

export type Training = { records: HistoryRecord[]; history: ExerciseHistory[] };

/**
 * Everything the athlete logged: their own file's REGISTRO_PLANIFICACION (only their ID_ATLETA
 * rows, read with CATALOGO_EJERCICIOS) plus their CrossFit log in Firestore. A lift logged in
 * CrossFit joins the same exercise of the catalog; what the catalog doesn't list (WODs, other
 * lifts) gets its own entry after the catalog's.
 * Shares REGISTRO's cache with saving, so a result saved in the app shows up right away.
 */
export async function getTraining(athlete: Athlete): Promise<Training> {
  const [registro, catalog, logs] = await Promise.all([
    athlete.spreadsheetId ? readRange(athlete.spreadsheetId, REGISTRO_RANGE) : Promise.resolve([]),
    athlete.spreadsheetId ? readRange(athlete.spreadsheetId, CATALOG_RANGE) : Promise.resolve([]),
    listCrossfitLogs(athlete.id),
  ]);
  const sheetCatalog = parseHistoryCatalog(catalog, CATALOG_TYPES[athlete.planType]);
  const records = [...(registro.length ? parseHistoryRecords(registro, athlete.id) : []), ...crossfitRecords(logs)];
  const known = new Set(sheetCatalog.map((e) => e.key));
  const history = buildHistory(
    [...sheetCatalog, ...crossfitCatalog(logs, known)],
    records,
    // Like HISTORIAL (DASHBOARD!C9): the athlete's current weight from the master ATLETAS tab.
    athlete.bodyWeightKg,
  );
  return { records, history };
}

/** The signed-in athlete's history per exercise (see getTraining). */
export async function getHistory(athlete: Athlete): Promise<ExerciseHistory[]> {
  return (await getTraining(athlete)).history;
}
