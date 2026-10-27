import type { Athlete } from "./athletes";
import { buildWorkout, MI_FIRST_ROW, MI_RANGE, parsePlanRows, PLAN_RANGE } from "./personalized";
import { appendRows, readRange, writeCells } from "./sheets";
import { MAX_SETS, type DaySelection, type Exercise } from "./types";

export { MAX_SETS };

// Results log read by the coach's DASHBOARD and HISTORIAL tabs.
const REGISTRO_RANGE = "REGISTRO_PLANIFICACION!A:P";
const CATALOG_RANGE = "CATALOGO_EJERCICIOS!A:Z";
const TIME_ZONE = "America/Argentina/Buenos_Aires";

export type SetResult = { set: number; load?: number; reps?: number };
/** Latest saved sets per exercise name (uppercase). */
export type SavedResults = Record<string, SetResult[]>;

const label = (value: string | undefined) => (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

/** Key of an exercise in SavedResults. */
export const resultKey = (exerciseName: string) => label(exerciseName);

/** "97,50 KG" (MI_PLANIFICACION's format), "97.5" or "97,5" → 97.5. */
function toNumber(value: string | undefined): number | undefined {
  const raw = (value ?? "").trim().replace(/\s*kg$/i, "").replace(",", ".");
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

type SheetRow = { row: number; order: string; name: string; sets: SetResult[] };
/** MI_PLANIFICACION: the week/day open in the sheet and the Carga/Reps typed on each exercise row. */
export type SheetLoads = { selection: DaySelection; loadColumns: number[]; rows: SheetRow[] };

/** Parses MI_RANGE. Null when the tab doesn't have its usual header. */
export function parseSheetLoads(rows: string[][]): SheetLoads | null {
  const [selector = []] = rows;
  const headerAt = rows.findIndex((row) => row.some((cell) => label(cell) === "EJERCICIO"));
  if (headerAt < 0) return null;
  const col = headerIndex(rows[headerAt]);
  const orderIdx = col("ORDEN");
  const nameIdx = col("EJERCICIO");
  // Each SERIE is a CARGA column followed by its REPS column.
  const loadColumns = rows[headerAt]
    .flatMap((h, i) => (label(h) === "CARGA" && label(rows[headerAt][i + 1]) === "REPS" ? [i] : []))
    .slice(0, MAX_SETS);

  // Like buildWorkout: a row without ORDEN belongs to the block of the row above.
  let previousOrder = "";
  const data = rows.slice(headerAt + 1).flatMap((row, i) => {
    const order = label(row[orderIdx]) || previousOrder;
    previousOrder = order;
    if (!row[nameIdx]?.trim()) return [];
    const sets = loadColumns
      .map((c, set) => ({ set: set + 1, load: toNumber(row[c]), reps: toNumber(row[c + 1]) }))
      .filter(({ load, reps }) => load !== undefined || reps !== undefined);
    return [{ row: MI_FIRST_ROW + headerAt + 1 + i, order, name: label(row[nameIdx]), sets }];
  });

  return { selection: { week: label(selector[1]), day: label(selector[3]) }, loadColumns, rows: data };
}

const isOpenDay = (sheet: SheetLoads | null, { week, day }: DaySelection): sheet is SheetLoads =>
  sheet?.selection.week === week && sheet.selection.day === day;

/** The MI_PLANIFICACION row of an exercise (by name and ORDEN; by name alone if that's unambiguous). */
export function findSheetRow(sheet: SheetLoads, exercise: Pick<Exercise, "name" | "order">): SheetRow | undefined {
  const named = sheet.rows.filter((r) => r.name === label(exercise.name));
  return named.find((r) => r.order === label(exercise.order)) ?? (named.length === 1 ? named[0] : undefined);
}

/**
 * Saved results, with every exercise of MI_PLANIFICACION taken from the sheet as is: it's the
 * newest for the open day, so cells cleared there stay cleared even if REGISTRO_PLANIFICACION
 * has older rows. Exercises not in the sheet keep what REGISTRO_PLANIFICACION has.
 */
export function mergeSheetLoads(saved: SavedResults, sheet: SheetLoads): SavedResults {
  const merged = { ...saved };
  for (const { name } of sheet.rows) delete merged[name];
  // An exercise can appear twice (in two blocks): keep the row that has loads.
  for (const { name, sets } of sheet.rows) if (sets.length) merged[name] = sets;
  return merged;
}

const columnLetter = (index: number): string =>
  (index >= 26 ? columnLetter(Math.floor(index / 26) - 1) : "") + String.fromCharCode(65 + (index % 26));

/** Cell writes that put the app's Carga/Reps on one MI_PLANIFICACION row (empty values clear the cell). */
export function sheetLoadCells(sheet: SheetLoads, row: number, sets: SetResult[]) {
  const tab = MI_RANGE.split("!")[0];
  return sets
    .filter(({ set }) => set <= sheet.loadColumns.length)
    .map(({ set, load, reps }) => {
      const c = sheet.loadColumns[set - 1];
      return {
        range: `${tab}!${columnLetter(c)}${row}:${columnLetter(c + 1)}${row}`,
        values: [[load ?? "", reps ?? ""]],
      };
    });
}

export async function getSavedResults(athlete: Athlete, selection: DaySelection): Promise<SavedResults> {
  if (!athlete.spreadsheetId) return {};
  // Fresh: the athlete may have just typed or cleared loads in the sheet.
  const [registro, sheetRows] = await Promise.all([
    readRange(athlete.spreadsheetId, REGISTRO_RANGE, { fresh: true }),
    readRange(athlete.spreadsheetId, MI_RANGE, { fresh: true }),
  ]);
  const saved = parseResults(registro, athlete.id, selection);
  const sheet = parseSheetLoads(sheetRows);
  return isOpenDay(sheet, selection) ? mergeSheetLoads(saved, sheet) : saved;
}

export class ResultError extends Error {}

export type SaveInput = DaySelection & { name: string; order?: string; sets: SetResult[] };

// The athlete can log more series than prescribed, up to the 6 Carga/Reps pairs of the sheet.
function validSet({ set, load, reps }: SetResult) {
  const inRange = (value: number | undefined, max: number) => value === undefined || (value >= 0 && value <= max);
  return Number.isInteger(set) && set >= 1 && set <= MAX_SETS && inRange(load, 1000) && inRange(reps, 1000);
}

/**
 * Appends the athlete's changed sets for one exercise to REGISTRO_PLANIFICACION, and writes them
 * into MI_PLANIFICACION's Carga/Reps cells when that week/day is the one selected in the sheet.
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

  if (!input.sets.every(validSet)) throw new ResultError("Revisá los valores cargados.");

  const [registro, catalog, sheetRows] = await Promise.all([
    readRange(id, REGISTRO_RANGE),
    readRange(id, CATALOG_RANGE),
    // Fresh: the athlete may have switched week/day in the sheet a moment ago.
    readRange(id, MI_RANGE, { fresh: true }),
  ]);
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

  // Mirror the loads in MI_PLANIFICACION when this day is the one open in the sheet.
  const sheet = parseSheetLoads(sheetRows);
  const target = isOpenDay(sheet, selection) ? findSheetRow(sheet, exercise) : undefined;
  if (sheet && target) await writeCells(id, sheetLoadCells(sheet, target.row, input.sets), MI_RANGE);
  return rows.length;
}
