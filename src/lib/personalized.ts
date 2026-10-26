import type { Athlete } from "./athletes";
import { readRange } from "./sheets";
import type { Block, DaySelection, Exercise, WeekSummary, Workout } from "./types";

const PLAN_RANGE = "BASE_PLANIFICACION!A:K";
// Week (B3) and day (D3) currently selected in the athlete's sheet.
const SELECTOR_RANGE = "MI_PLANIFICACION!A3:D3";

type PlanRow = { week: string; day: string; exercise: Exercise };

const clean = (value: string | undefined) => value?.trim() || undefined;
const label = (value: string | undefined) => (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
const numberIn = (value: string) => Number(value.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
const byNumber = (a: string, b: string) => numberIn(a) - numberIn(b);
const byOrder = (a = "", b = "") => a.localeCompare(b, "es", { numeric: true });

/** "00:02:00" (a duration cell) → "2 MIN"; anything else is kept as written. */
export function formatDuration(value: string | undefined): string | undefined {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return clean(value);
  const [, h, m, s] = match.map(Number);
  const minutes = h * 60 + m;
  if (minutes && s) return `${minutes} MIN ${s} SEG`;
  return minutes ? `${minutes} MIN` : `${s} SEG`;
}

/** Rows of BASE_PLANIFICACION that belong to one athlete. The file can contain other athletes' rows. */
export function parsePlanRows(rows: string[][], athleteId: string): PlanRow[] {
  const [header = [], ...data] = rows;
  const col = (name: string) => header.findIndex((h) => label(h) === name);
  const idx = {
    name: col("EJERCICIO"),
    sets: col("SERIES"),
    reps: col("REPETICIONES"),
    target: col("OBJETIVO"),
    rest: col("DESCANSO"),
    interval: col("INTERVALO"),
    notes: col("NOTAS"),
    id: col("ID"),
    week: col("SEMANA"),
    day: col("DIA"),
    order: col("ORDEN"),
  };
  if (idx.name < 0 || idx.id < 0 || idx.week < 0 || idx.day < 0) {
    throw new Error("BASE_PLANIFICACION is missing one of the columns EJERCICIO, ID, SEMANA, DIA");
  }

  return data
    .filter((row) => row[idx.id]?.trim() === athleteId && clean(row[idx.name]))
    .map((row) => ({
      week: label(row[idx.week]),
      day: label(row[idx.day]),
      exercise: {
        name: row[idx.name].trim(),
        order: clean(row[idx.order])?.toUpperCase(),
        sets: clean(row[idx.sets]),
        reps: clean(row[idx.reps]),
        target: clean(row[idx.target]),
        rest: formatDuration(row[idx.rest]),
        interval: clean(row[idx.interval]),
        notes: clean(row[idx.notes]),
      },
    }));
}

export function listWeeks(rows: PlanRow[]): WeekSummary[] {
  const weeks = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!weeks.has(row.week)) weeks.set(row.week, new Set());
    weeks.get(row.week)!.add(row.day);
  }
  return [...weeks.keys()].sort(byNumber).map((week) => ({ week, days: [...weeks.get(week)!].sort(byNumber) }));
}

/**
 * Groups a day's rows into blocks by the letter of ORDEN (A1, A2 → block A).
 * A row without ORDEN stays in the block of the row above it, as the coach wrote it.
 * WOD rows become text lines (their content is in NOTAS) instead of exercises.
 */
export function buildWorkout(rows: PlanRow[], week: string, day: string): Workout {
  const blocks = new Map<string, { block: Block; wodLines: { order: string; lines: string[] }[] }>();
  let previousOrder = "";

  for (const { exercise } of rows.filter((r) => r.week === week && r.day === day)) {
    const order = exercise.order ?? previousOrder;
    previousOrder = order;
    const letter = order.match(/^[A-Z]+/)?.[0] ?? "";
    if (!blocks.has(letter)) blocks.set(letter, { block: { title: letter, lines: [], exercises: [] }, wodLines: [] });
    const entry = blocks.get(letter)!;

    if (exercise.name.toUpperCase() === "WOD") {
      const lines = [exercise.notes, exercise.interval]
        .flatMap((text) => text?.split("\n") ?? [])
        .map((line) => line.trim())
        .filter(Boolean);
      entry.wodLines.push({ order, lines });
    } else {
      entry.block.exercises.push({ ...exercise, order });
    }
  }

  return {
    week,
    day,
    blocks: [...blocks.keys()].sort(byOrder).map((letter) => {
      const { block, wodLines } = blocks.get(letter)!;
      block.exercises.sort((a, b) => byOrder(a.order, b.order));
      block.lines = wodLines.sort((a, b) => byOrder(a.order, b.order)).flatMap((w) => w.lines);
      return block;
    }),
  };
}

/** First of the candidates that exists in the plan; otherwise the first day of the latest week. */
export function pickDay(weeks: WeekSummary[], ...candidates: Partial<DaySelection>[]): DaySelection | null {
  for (const { week, day } of candidates) {
    const match = weeks.find((w) => w.week === label(week));
    if (match?.days.includes(label(day))) return { week: match.week, day: label(day) };
  }
  const latest = weeks.at(-1);
  return latest ? { week: latest.week, day: latest.days[0] } : null;
}

export type PersonalizedPlan = { weeks: WeekSummary[]; selected: DaySelection; workout: Workout };

/**
 * Plan of a personalized athlete, opened on `requested` if given, else on the week/day
 * selected in their MI_PLANIFICACION sheet. Null when the athlete has no file or no rows yet.
 */
export async function getPersonalizedPlan(
  athlete: Athlete,
  requested: Partial<DaySelection> = {},
): Promise<PersonalizedPlan | null> {
  if (!athlete.spreadsheetId) return null;

  const [planRows, selectorRows] = await Promise.all([
    readRange(athlete.spreadsheetId, PLAN_RANGE),
    readRange(athlete.spreadsheetId, SELECTOR_RANGE),
  ]);
  const rows = parsePlanRows(planRows, athlete.id);
  const weeks = listWeeks(rows);
  const [selector = []] = selectorRows;
  const selected = pickDay(weeks, requested, { week: selector[1], day: selector[3] });
  if (!selected) return null;

  return { weeks, selected, workout: buildWorkout(rows, selected.week, selected.day) };
}
