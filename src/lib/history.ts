import { estimateOneRepMax, resultKey } from "./results";

/**
 * Performance history per exercise, like the coach's HISTORIAL tab but for the signed-in athlete
 * and every exercise at once. Pure functions over the rows of CATALOGO_EJERCICIOS and
 * REGISTRO_PLANIFICACION (as displayed in the sheet); reading them lives in history-data.ts.
 */

/** How the catalog's TIPO_MEDICION says a result is measured. */
export type Measurement = "LOAD_REPS" | "LOAD" | "REPS" | "TIME";
/** MEJOR_RESULTADO: whether a bigger (MAYOR) or smaller (MENOR) value is better. */
export type Better = "HIGHER" | "LOWER";
/** What a day's value (and the chart) measures. */
export type Metric = "e1rm" | "load" | "reps" | "time";

const MEASUREMENTS: Record<string, Measurement> = {
  CARGA_REPS: "LOAD_REPS",
  CARGA: "LOAD",
  REPS: "REPS",
  REPETICIONES: "REPS",
  TIEMPO: "TIME",
};

export const isStrength = (measurement: Measurement) => measurement === "LOAD_REPS" || measurement === "LOAD";

export type CatalogExercise = {
  /** Normalized name (trimmed, uppercase, single spaces): how REGISTRO rows are matched. */
  key: string;
  name: string;
  category: string;
  measurement: Measurement;
  better: Better;
  /** Catalog E1RM = SI (only for exercises measured with a load). */
  withE1rm: boolean;
  /** Catalog PESO_CORPORAL isn't NO: the E1RM / body weight ratio applies. */
  withBodyWeight: boolean;
};

export type HistoryRecord = {
  exercise: string;
  /** Sortable local timestamp, "2026-10-01T15:45:28". */
  at: string;
  /** Training day, "2026-10-01" (like INT(FECHA) in the sheet). */
  date: string;
  set?: number;
  load?: number;
  reps?: number;
  /** RESULTADO and UNIDAD as written (times live there, e.g. "0:08:15"). */
  result: string;
  unit: string;
};

export type HistorySet = { at: string; set?: number; load?: number; reps?: number; seconds?: number; e1rm?: number };

export type HistoryDay = {
  date: string;
  /** The day's best set: highest E1RM for strength (as HISTORIAL), else best reps or time. */
  best: HistorySet;
  /** The best set's value in the exercise's metric. */
  value: number;
  /** Heaviest load lifted that day (any set). */
  topLoad?: number;
  ratio?: number;
  /** Every set logged that day, by SERIE (corrections of a series after the original). */
  sets: HistorySet[];
};

export type HistorySummary = {
  /** Strength: heaviest CARGA logged, whatever set has the best E1RM. */
  bestLoad?: number;
  bestE1rm?: number;
  ratio?: number;
  /** Best value in the exercise's metric (reps, seconds, kg or E1RM). */
  best?: number;
  lastAt?: string;
  /** % improvement of the best value over the first day's best (positive = better, also for times). */
  progress?: number;
};

export type ExerciseHistory = CatalogExercise & { metric: Metric; summary: HistorySummary; days: HistoryDay[] };

const label = resultKey;

function headerIndex(header: string[]) {
  return (name: string) => header.findIndex((h) => label(h) === name);
}

/** "60,50 KG", "52.5", "1.234,5" → number. Sheets shows decimals with a comma in Spanish locales. */
export function parseDecimal(value: string | undefined): number | undefined {
  let raw = (value ?? "").trim().replace(/\s*(kg|reps?)$/i, "").replace(/\s/g, "");
  if (!raw) return undefined;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * FECHA as the sheet shows it ("1/10/2026 15:45:28", d/MM/yyyy) or as the app writes it
 * ("2026-10-01 15:45:28"), without time zone conversions: it's already Argentina's local time.
 */
export function parseTimestamp(value: string | undefined): { at: string; date: string } | undefined {
  const text = (value ?? "").trim();
  const time = "(?:[ T]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?";
  const dmy = text.match(new RegExp(`^(\\d{1,2})/(\\d{1,2})/(\\d{4})${time}`));
  const ymd = text.match(new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${time}`));
  const parts = dmy ? [dmy[3], dmy[2], dmy[1], dmy[4], dmy[5], dmy[6]] : ymd ? ymd.slice(1, 7) : null;
  if (!parts) return undefined;
  const [year, month, day, hours = "0", minutes = "0", seconds = "0"] = parts;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return undefined;
  const pad = (n: string) => n.padStart(2, "0");
  const date = `${year}-${pad(month)}-${pad(day)}`;
  return { at: `${date}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, date };
}

/** A time result in seconds: "4:35" (m:ss), "1:04:35" (h:mm:ss, the sheet's [h]:mm:ss) or plain seconds. */
export function parseDuration(value: string | undefined): number | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  const parts = text.split(":").map((part) => parseDecimal(part));
  if (parts.length > 3 || parts.some((part) => part === undefined || part < 0)) return undefined;
  const total = (parts as number[]).reduce((sum, part) => sum * 60 + part, 0);
  return total > 0 ? total : undefined;
}

function measurementOf(type: string, unit: string): Measurement {
  if (MEASUREMENTS[type]) return MEASUREMENTS[type];
  if (/SEG|MIN|:/.test(unit)) return "TIME";
  return unit === "REPS" ? "REPS" : "LOAD_REPS";
}

/**
 * Exercises the catalog marks with REGISTRAR_HISTORIAL = SI, once each. When a name is listed
 * for several athlete types (SNATCH for FUERZA and CROSSFIT), the athlete's own type wins.
 */
export function parseHistoryCatalog(rows: string[][], athleteType?: string): CatalogExercise[] {
  const [header = [], ...data] = rows;
  const col = headerIndex(header);
  const idx = {
    name: col("EJERCICIO"),
    type: col("TIPO_ATLETA"),
    category: col("CATEGORIA"),
    measurement: col("TIPO_MEDICION"),
    unit: col("UNIDAD"),
    better: col("MEJOR_RESULTADO"),
    bodyWeight: col("PESO_CORPORAL"),
    e1rm: col("E1RM"),
    history: col("REGISTRAR_HISTORIAL"),
  };
  if (idx.name < 0 || idx.history < 0) return [];

  const found = new Map<string, CatalogExercise>();
  const foundType = new Map<string, string>();
  for (const row of data) {
    const key = label(row[idx.name]);
    if (!key || label(row[idx.history]) !== "SI") continue;
    const type = label(row[idx.type]);
    if (found.has(key) && (foundType.get(key) === athleteType || type !== athleteType)) continue;

    const measurement = measurementOf(label(row[idx.measurement]), label(row[idx.unit]));
    const better = label(row[idx.better]);
    found.set(key, {
      key,
      name: row[idx.name].trim().replace(/\s+/g, " "),
      category: label(row[idx.category]),
      measurement,
      better: better === "MENOR" || (better !== "MAYOR" && measurement === "TIME") ? "LOWER" : "HIGHER",
      withE1rm: isStrength(measurement) && label(row[idx.e1rm]) === "SI",
      withBodyWeight: label(row[idx.bodyWeight]) !== "NO",
    });
    foundType.set(key, type);
  }
  return [...found.values()];
}

/** REGISTRO_PLANIFICACION rows of one athlete (other athletes' rows never leave this function). */
export function parseHistoryRecords(rows: string[][], athleteId: string): HistoryRecord[] {
  const [header = [], ...data] = rows;
  const col = headerIndex(header);
  const idx = {
    date: col("FECHA"),
    id: col("ID_ATLETA"),
    name: col("EJERCICIO"),
    set: col("SERIE"),
    load: col("CARGA"),
    reps: col("REPS_REALES"),
    result: col("RESULTADO"),
    unit: col("UNIDAD"),
  };
  if (idx.date < 0 || idx.id < 0 || idx.name < 0) throw new Error("REGISTRO_PLANIFICACION is missing a required column");
  const id = athleteId.trim();

  return data.flatMap((row) => {
    const when = parseTimestamp(row[idx.date]);
    const exercise = label(row[idx.name]);
    if (row[idx.id]?.trim() !== id || !when || !exercise) return [];
    // A row with only the athlete's note (no series or result) isn't a set.
    if (![idx.set, idx.load, idx.reps, idx.result].some((i) => i >= 0 && row[i]?.trim())) return [];
    return [
      {
        exercise,
        ...when,
        set: parseDecimal(row[idx.set]),
        load: parseDecimal(row[idx.load]),
        reps: parseDecimal(row[idx.reps]),
        result: row[idx.result]?.trim() ?? "",
        unit: label(row[idx.unit]),
      },
    ];
  });
}

function metricOf({ measurement, withE1rm }: CatalogExercise): Metric {
  if (measurement === "REPS") return "reps";
  if (measurement === "TIME") return "time";
  return withE1rm ? "e1rm" : "load";
}

function toSet(exercise: CatalogExercise, record: HistoryRecord): HistorySet {
  const { at, set, load, reps } = record;
  if (exercise.measurement === "TIME") return { at, set, seconds: parseDuration(record.result) };
  if (exercise.measurement === "REPS") {
    // Reps-only sets keep the count in REPS_REALES; RESULTADO has it too when UNIDAD is REPS.
    return { at, set, load, reps: reps ?? (record.unit === "REPS" ? parseDecimal(record.result) : undefined) };
  }
  // Like HISTORIAL: E1RM only for sets with both CARGA and REPS_REALES.
  const e1rm = exercise.withE1rm && load !== undefined && reps !== undefined ? estimateOneRepMax(load, reps) : undefined;
  return { at, set, load, reps, e1rm };
}

const VALUE: Record<Metric, (set: HistorySet) => number | undefined> = {
  e1rm: (set) => set.e1rm,
  load: (set) => set.load,
  reps: (set) => set.reps,
  time: (set) => set.seconds,
};

const max = (values: (number | undefined)[]) => {
  const numbers = values.filter((v): v is number => v !== undefined);
  return numbers.length ? Math.max(...numbers) : undefined;
};

/** Ties keep the first one, like HISTORIAL's INDEX(FILTER(…), 1). */
const isBetter = (better: Better, value: number, than: number) => (better === "HIGHER" ? value > than : value < than);

/** Positive when the best beats the first day's best: +% for bigger values, −% of time for times. */
function progressOf(better: Better, first: number, best: number): number | undefined {
  if (first <= 0) return undefined;
  return better === "HIGHER" ? (best / first - 1) * 100 : (1 - best / first) * 100;
}

/** One exercise's days (newest first) and headline numbers, from that exercise's records. */
export function buildExerciseHistory(exercise: CatalogExercise, records: HistoryRecord[], bodyWeightKg?: number): ExerciseHistory {
  const metric = metricOf(exercise);
  const valueOf = VALUE[metric];
  const ratioOf = (e1rm: number | undefined) =>
    e1rm !== undefined && bodyWeightKg && exercise.withBodyWeight ? e1rm / bodyWeightKg : undefined;

  const byDate = new Map<string, HistorySet[]>();
  for (const record of records) {
    if (!byDate.has(record.date)) byDate.set(record.date, []);
    byDate.get(record.date)!.push(toSet(exercise, record));
  }

  const days: HistoryDay[] = [];
  for (const [date, sets] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    let best: HistorySet | undefined;
    for (const set of sets) {
      const value = valueOf(set);
      if (value !== undefined && (!best || isBetter(exercise.better, value, valueOf(best)!))) best = set;
    }
    if (!best) continue;
    days.push({
      date,
      best,
      value: valueOf(best)!,
      topLoad: isStrength(exercise.measurement) ? max(sets.map((s) => s.load)) : undefined,
      ratio: ratioOf(best.e1rm),
      sets: [...sets].sort((a, b) => (a.set ?? Infinity) - (b.set ?? Infinity) || a.at.localeCompare(b.at)),
    });
  }

  let best: number | undefined;
  for (const day of days) if (best === undefined || isBetter(exercise.better, day.value, best)) best = day.value;
  const bestE1rm = metric === "e1rm" ? best : undefined;

  const summary: HistorySummary = {
    bestLoad: isStrength(exercise.measurement) ? max(records.map((r) => r.load)) : undefined,
    bestE1rm,
    ratio: ratioOf(bestE1rm),
    best,
    lastAt: records.reduce<string | undefined>((latest, r) => (!latest || r.at > latest ? r.at : latest), undefined),
    progress: days.length && best !== undefined ? progressOf(exercise.better, days[0].value, best) : undefined,
  };

  return { ...exercise, metric, summary, days: days.reverse() };
}

/** Every catalog exercise's history, in catalog order (exercises without records included). */
export function buildHistory(catalog: CatalogExercise[], records: HistoryRecord[], bodyWeightKg?: number): ExerciseHistory[] {
  const byExercise = new Map<string, HistoryRecord[]>();
  for (const record of records) {
    if (!byExercise.has(record.exercise)) byExercise.set(record.exercise, []);
    byExercise.get(record.exercise)!.push(record);
  }
  return catalog.map((exercise) => buildExerciseHistory(exercise, byExercise.get(exercise.key) ?? [], bodyWeightKg));
}

/** The exercise to open: the remembered one if it's still listed, else the one trained most recently. */
export function defaultExercise(history: Pick<ExerciseHistory, "key" | "summary">[], remembered?: string): string | undefined {
  const key = remembered ? label(remembered) : undefined;
  if (key && history.some((e) => e.key === key)) return key;
  const latest = history.reduce<(typeof history)[number] | undefined>(
    (found, e) => (e.summary.lastAt && (!found?.summary.lastAt || e.summary.lastAt > found.summary.lastAt) ? e : found),
    undefined,
  );
  return (latest ?? history[0])?.key;
}
