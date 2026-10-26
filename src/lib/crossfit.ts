import { getCrossfitSpreadsheetId, readHiddenColumns, readRange } from "./sheets";
import type { Block, Exercise, Workout } from "./types";

const PLAN_SHEET = "PLANIFICACIÓN";
const ANEXO_SHEET = "ANEXO";

const COL_B = 1;
const COL_C = 2;

const DAY_ROW = /^DIA\s*\d+/;
const WARM_UP = "ENTRADA EN CALOR";
// Start of a section inside a block: "A. 3 RONDAS:", "B: …".
const SECTION_START = /^[A-Z]\s*[.:]/;

const text = (value: string | undefined) => (value ?? "").trim();
const label = (value: string | undefined) => text(value).toUpperCase().replace(/\s+/g, " ");
const optional = (value: string | undefined) => text(value) || undefined;

/** "0.75" → "75%"; "75%" or "65-70%" are kept as written. */
export function formatPercent(value: string | undefined): string | undefined {
  const raw = text(value);
  const number = Number(raw.replace(",", "."));
  if (raw && !Number.isNaN(number) && number > 0 && number <= 1.5) return `${Math.round(number * 100)}%`;
  return raw || undefined;
}

/** "8" → "RPE 8"; anything else is kept as written. */
function formatRpe(value: string | undefined): string | undefined {
  const raw = text(value);
  return /^\d+([.,]\d+)?$/.test(raw) ? `RPE ${raw}` : raw || undefined;
}

const joinTarget = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined;

type SideColumns = { sets: number; reps?: number; rpe?: number; percent?: number };

/** The SERIES/REPS/RPE/% group the athlete sees: the first one whose SERIES column isn't hidden. */
export function findSideColumns(headerRow: string[], hidden: boolean[]): SideColumns | null {
  const sets = headerRow.findIndex((cell, i) => i > COL_C && label(cell) === "SERIES" && !hidden[i]);
  if (sets < 0) return null;

  const group: SideColumns = { sets };
  for (let i = sets + 1; i < headerRow.length && label(headerRow[i]) !== "SERIES"; i++) {
    const name = label(headerRow[i]);
    if (name === "REPS") group.reps = i;
    else if (name === "RPE") group.rpe = i;
    else if (name.startsWith("%")) group.percent = i;
  }
  return group;
}

/**
 * Days of the PLANIFICACIÓN tab. Each day starts at a "DIA n" row in column C; blocks start where
 * column B has a label (ENTRADA EN CALOR, BLOQUE n); each column C line becomes one item, with the
 * series/reps/RPE/% the athlete sees next to it.
 */
export function parseCrossfitDays(rows: string[][], hidden: boolean[]): Workout[] {
  const days: Workout[] = [];
  let day: Workout | undefined;
  let dayRow: string[] = [];
  let side: SideColumns | null = null;
  let block: Block | undefined;

  const startBlock = (title: string) => {
    block = { title, lines: [], exercises: [] };
    day!.blocks.push(block);
  };

  for (const row of rows) {
    const b = text(row[COL_B]);
    const c = text(row[COL_C]);

    if (DAY_ROW.test(label(c))) {
      day = { week: "", day: label(c), blocks: [] };
      days.push(day);
      dayRow = row;
      side = null;
      block = undefined;
      continue;
    }
    if (!day) continue;

    if (!side && row.some((cell) => label(cell) === "SERIES")) {
      side = findSideColumns(row, hidden);
      day.week = label(side ? dayRow[side.sets] : "");
      continue;
    }

    if (b) startBlock(b.replace(/:$/, ""));
    if (!c) continue;
    // The warm-up label covers a single line; a section right after it is its own block.
    if (!block || (block.title === WARM_UP && block.exercises.length > 0 && SECTION_START.test(c))) startBlock("");

    const exercise: Exercise = { name: c };
    if (side) {
      exercise.sets = optional(row[side.sets]);
      exercise.reps = side.reps === undefined ? undefined : optional(row[side.reps]);
      exercise.target = joinTarget(
        side.rpe === undefined ? undefined : formatRpe(row[side.rpe]),
        side.percent === undefined ? undefined : formatPercent(row[side.percent]),
      );
    }
    block!.exercises.push(exercise);
  }

  for (const d of days) d.blocks = d.blocks.filter((b) => b.exercises.length > 0);
  return days;
}

export type AnexoPlan = { title: string; weeks: { week: string; blocks: Block[] }[] };
export type Anexo = { intro: string[]; plans: AnexoPlan[] };

type WeekColumns = { week: string; sets?: number; reps?: number; rpe?: number; percent?: number };

/**
 * The ANEXO tab: intro text, then plans ("PLAN DE FUERZA", "PLAN DE GIMNASTICOS"), each a grid of
 * exercises × SEMANA 1..4 × SERIES/REPETICIONES/RPE/PORCENTAJE. Each week becomes one block per day.
 */
export function parseAnexo(rows: string[][]): Anexo {
  const anexo: Anexo = { intro: [], plans: [] };
  let plan: AnexoPlan | undefined;
  let weekStarts: { week: string; start: number }[] = [];
  let weeks: WeekColumns[] = [];
  let day = "";

  for (const row of rows) {
    const a = label(row[0]);
    const b = text(row[COL_B]);

    if (label(b).startsWith("PLAN ")) {
      plan = { title: b, weeks: [] };
      anexo.plans.push(plan);
      weekStarts = [];
      weeks = [];
      continue;
    }
    if (!plan) {
      if (b) anexo.intro.push(b);
      continue;
    }

    if (label(b) === "EJERCICIOS") {
      weekStarts = row.flatMap((cell, i) => (label(cell).startsWith("SEMANA") ? [{ week: label(cell), start: i }] : []));
      continue;
    }
    if (weekStarts.length && !weeks.length) {
      // Sub-header row: SERIES / REPETICIONES / RPE / PORCENTAJE under each week.
      weeks = weekStarts.map(({ week, start }, w) => {
        const end = weekStarts[w + 1]?.start ?? row.length;
        const columns: WeekColumns = { week };
        for (let i = start; i < end; i++) {
          const name = label(row[i]);
          if (name === "SERIES") columns.sets = i;
          else if (name === "REPETICIONES") columns.reps = i;
          else if (name === "RPE") columns.rpe = i;
          else if (name === "PORCENTAJE") columns.percent = i;
        }
        return columns;
      });
      continue;
    }

    if (a) day = a;
    if (!b || !weeks.length) continue;

    for (const columns of weeks) {
      const cell = (i: number | undefined) => (i === undefined ? undefined : optional(row[i]));
      const exercise: Exercise = {
        name: b,
        sets: cell(columns.sets),
        reps: cell(columns.reps),
        target: joinTarget(formatRpe(cell(columns.rpe)), formatPercent(cell(columns.percent))),
      };
      if (!exercise.sets && !exercise.reps && !exercise.target) continue;

      let week = plan.weeks.find((w) => w.week === columns.week);
      if (!week) plan.weeks.push((week = { week: columns.week, blocks: [] }));
      let dayBlock = week.blocks.find((bl) => bl.title === day);
      if (!dayBlock) week.blocks.push((dayBlock = { title: day, lines: [], exercises: [] }));
      dayBlock.exercises.push(exercise);
    }
  }
  return anexo;
}

export type CrossfitPlan = { days: string[]; selectedDay: string; workout: Workout; anexo: Anexo };

/** The shared CrossFit programming, opened on `requestedDay` if it exists, else the first day. */
export async function getCrossfitPlan(requestedDay?: string): Promise<CrossfitPlan | null> {
  const id = getCrossfitSpreadsheetId();
  const [planRows, hidden, anexoRows] = await Promise.all([
    readRange(id, `'${PLAN_SHEET}'`),
    readHiddenColumns(id, PLAN_SHEET),
    readRange(id, `'${ANEXO_SHEET}'`),
  ]);

  const workouts = parseCrossfitDays(planRows, hidden);
  const workout = workouts.find((w) => w.day === label(requestedDay)) ?? workouts[0];
  if (!workout) return null;

  return { days: workouts.map((w) => w.day), selectedDay: workout.day, workout, anexo: parseAnexo(anexoRows) };
}
