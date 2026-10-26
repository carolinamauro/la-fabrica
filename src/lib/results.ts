import type { Athlete } from "./athletes";
import { buildWorkout, parsePlanRows, PLAN_RANGE } from "./personalized";
import { appendRows, readRange } from "./sheets";
import type { DaySelection, Exercise } from "./types";

// Results log read by the coach's DASHBOARD and HISTORIAL tabs.
const REGISTRO_RANGE = "REGISTRO_PLANIFICACION!A:P";
const CATALOG_RANGE = "CATALOGO_EJERCICIOS!A:Z";
// MI_PLANIFICACION has 6 SERIE groups (Carga + Reps, columns I–T).
export const MAX_SETS = 6;
const TIME_ZONE = "America/Argentina/Buenos_Aires";

export type SetResult = { set: number; load?: number; reps?: number };
/** Latest saved sets per exercise name (uppercase). */
export type SavedResults = Record<string, SetResult[]>;

const label = (value: string | undefined) => (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

/** Key of an exercise in SavedResults. */
export const resultKey = (exerciseName: string) => label(exerciseName);

function toNumber(value: string | undefined): number | undefined {
  const raw = (value ?? "").trim().replace(",", ".");
  const number = Number(raw);
  return raw && Number.isFinite(number) ? number : undefined;
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Estimated 1RM (Epley), as the sheet already stores it. */
export const epley = (load: number, reps: number) => round(load * (1 + reps / 30), 1);

/** How many set rows to show: the prescribed SERIES, between 1 and 6. */
export function setCount(sets: string | undefined): number {
  const count = parseInt(sets ?? "", 10);
  return Number.isFinite(count) ? Math.min(Math.max(count, 1), MAX_SETS) : 1;
}

function headerIndex(header: string[]) {
  return (name: string) => header.findIndex((h) => label(h) === name);
}

/** The latest load/reps the athlete saved for each exercise and set of one day (later rows win). */
export function parseResults(rows: string[][], athleteId: string, { week, day }: DaySelection): SavedResults {
  const [header = [], ...data] = rows;
  const col = headerIndex(header);
  const idx = {
    id: col("ID_ATLETA"),
    week: col("SEMANA"),
    day: col("DIA"),
    name: col("EJERCICIO"),
    set: col("SERIE"),
    load: col("CARGA"),
    reps: col("REPS_REALES"),
  };
  if (Object.values(idx).some((i) => i < 0)) throw new Error("REGISTRO_PLANIFICACION is missing a required column");

  const latest = new Map<string, Map<number, SetResult>>();
  for (const row of data) {
    if (row[idx.id]?.trim() !== athleteId || label(row[idx.week]) !== week || label(row[idx.day]) !== day) continue;
    const set = toNumber(row[idx.set]);
    if (!set) continue;
    const name = label(row[idx.name]);
    if (!latest.has(name)) latest.set(name, new Map());
    latest.get(name)!.set(set, { set, load: toNumber(row[idx.load]), reps: toNumber(row[idx.reps]) });
  }

  return Object.fromEntries(
    [...latest].map(([name, sets]) => [name, [...sets.values()].sort((a, b) => a.set - b.set)]),
  );
}

/** Exercise names (uppercase) the catalog marks with E1RM = SI. */
export function parseE1rmExercises(rows: string[][]): Set<string> {
  const [header = [], ...data] = rows;
  const col = headerIndex(header);
  const name = col("EJERCICIO");
  const e1rm = col("E1RM");
  if (name < 0 || e1rm < 0) return new Set();
  return new Set(data.filter((row) => label(row[e1rm]) === "SI").map((row) => label(row[name])));
}

type ResultRowsInput = {
  header: string[];
  athlete: Pick<Athlete, "id" | "bodyWeightKg">;
  selection: DaySelection;
  exercise: Exercise;
  sets: SetResult[];
  previous: SetResult[];
  withE1rm: boolean;
  recordedAt: string;
};

/** New REGISTRO_PLANIFICACION rows (in the tab's column order) for the sets that changed. */
export function buildResultRows({ header, athlete, selection, exercise, sets, previous, withE1rm, recordedAt }: ResultRowsInput) {
  return sets
    .filter(({ load, reps }) => load !== undefined || reps !== undefined)
    .filter((entry) => {
      const saved = previous.find((p) => p.set === entry.set);
      return !saved || saved.load !== entry.load || saved.reps !== entry.reps;
    })
    .map(({ set, load, reps }) => {
      const e1rm = withE1rm && load && reps ? epley(load, reps) : undefined;
      const values: Record<string, string | number | undefined> = {
        FECHA: recordedAt,
        ID_ATLETA: athlete.id,
        SEMANA: selection.week,
        DIA: selection.day,
        EJERCICIO: exercise.name,
        SERIE: set,
        REPS_PRESCRIPTAS: toNumber(exercise.reps) ?? exercise.reps,
        CARGA: load,
        REPS_REALES: reps,
        RESULTADO: load ?? reps,
        UNIDAD: load !== undefined ? "KG" : "REPS",
        OBJETIVO: exercise.target,
        PESO_CORPORAL: athlete.bodyWeightKg,
        E1RM: e1rm,
        RATIO_BW: e1rm && athlete.bodyWeightKg ? round(e1rm / athlete.bodyWeightKg, 2) : undefined,
      };
      return header.map((h) => values[label(h)] ?? "");
    });
}

/** Date and time in Argentina, in a format Sheets reads as a date ("2026-10-26 08:30:00"). */
export function formatRecordedAt(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: TIME_ZONE }).replace("T", " ");
}

export async function getSavedResults(athlete: Athlete, selection: DaySelection): Promise<SavedResults> {
  if (!athlete.spreadsheetId) return {};
  return parseResults(await readRange(athlete.spreadsheetId, REGISTRO_RANGE), athlete.id, selection);
}

export class ResultError extends Error {}

export type SaveInput = DaySelection & { name: string; order?: string; sets: SetResult[] };

function validSet({ set, load, reps }: SetResult, maxSet: number) {
  const inRange = (value: number | undefined, max: number) => value === undefined || (value >= 0 && value <= max);
  return Number.isInteger(set) && set >= 1 && set <= maxSet && inRange(load, 1000) && inRange(reps, 1000);
}

/**
 * Appends the athlete's changed sets for one exercise to REGISTRO_PLANIFICACION.
 * The exercise must be in that athlete's plan for that week/day. Returns how many rows were added.
 */
export async function saveResults(athlete: Athlete, input: SaveInput): Promise<number> {
  if (!athlete.spreadsheetId) throw new ResultError("Tu planilla todavía no está configurada.");
  const id = athlete.spreadsheetId;
  const selection = { week: label(input.week), day: label(input.day) };

  const planRows = parsePlanRows(await readRange(id, PLAN_RANGE), athlete.id);
  const exercise = buildWorkout(planRows, selection.week, selection.day)
    .blocks.flatMap((block) => block.exercises)
    .find((e) => label(e.name) === label(input.name) && (e.order ?? "") === (input.order ?? ""));
  if (!exercise) throw new ResultError("Este ejercicio ya no está en tu planificación. Actualizá la página.");

  const maxSet = setCount(exercise.sets);
  if (!input.sets.every((s) => validSet(s, maxSet))) throw new ResultError("Revisá los valores cargados.");

  const [registro, catalog] = await Promise.all([readRange(id, REGISTRO_RANGE), readRange(id, CATALOG_RANGE)]);
  const rows = buildResultRows({
    header: registro[0] ?? [],
    athlete,
    selection,
    exercise,
    sets: input.sets,
    previous: parseResults(registro, athlete.id, selection)[label(exercise.name)] ?? [],
    withE1rm: parseE1rmExercises(catalog).has(label(exercise.name)),
    recordedAt: formatRecordedAt(new Date()),
  });
  if (rows.length) await appendRows(id, REGISTRO_RANGE, rows);
  return rows.length;
}
