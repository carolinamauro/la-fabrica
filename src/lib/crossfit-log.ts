import type { CatalogExercise, HistoryRecord } from "./history";
import { MAX_SETS, type Exercise, type Workout } from "./types";

/**
 * What an athlete logs on the shared CrossFit plan, kept in Firestore (the shared sheet can't hold
 * one athlete's results). Pure functions: which lines can be logged, and logs → history records.
 *
 * - A lift (a line with a % or RPE, "4 BACK SQUAT · 75%") gets series of load × reps, filed under
 *   the lift's name ("BACK SQUAT") so it joins that exercise's history from the personalized plan.
 * - A WOD (a section "D. 4 MIN ON X …" without a lift) gets one result: time, rounds + reps or reps,
 *   Rx or scaled.
 */

export type WodScoreType = "time" | "rounds" | "reps";
export type WodScore = { type: WodScoreType; seconds?: number; rounds?: number; reps?: number };

export type LoggedSet = { set: number; load?: number; reps?: number; at: string };
export type LiftEntry = { kind: "lift"; exercise: string; line: string; sets: LoggedSet[]; note?: string };
export type WodEntry = { kind: "wod"; name: string; score: WodScore; rx: boolean; note?: string; at: string };
export type CrossfitLog = { key: string; week: string; day: string; entries: Record<string, LiftEntry | WodEntry> };

/** A line of the day that can be logged, by its id in the day ("l7", "w3"). */
export type LoggableItem =
  | { kind: "lift"; id: string; exercise: string; sets: number; reps?: number }
  | { kind: "wod"; id: string; name: string };

const label = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

const WARM_UP = "ENTRADA EN CALOR";
// "A. 3 RONDAS:", "D. 4 MIN ON X 1'30 MIN OFF": a part of the day. "A: 10 PUSH PRESS" is an item of an EMOM.
const SECTION_HEADER = /^[A-Z]\s*\.\s/;
// "(RPE8)", "(75%)" written on the line itself.
const INLINE_EFFORT = /\bRPE\s*\d|\d\s*%/i;
const LEADING_COUNT = /^\d+(?:[.,]\d+)?(?:\s*\+\s*\d+)*\s*(?:X\s+)?/i;

export const isSectionHeader = (line: string) => SECTION_HEADER.test(line.trim());

/** "A: 10 PUSH PRESS (RPE8)" → "PUSH PRESS"; "4 BACK SQUAT" → "BACK SQUAT". */
export function liftName(line: string): string {
  const name = line
    .replace(/^[A-Z]\s*[.:]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(LEADING_COUNT, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[:.]+$/, "");
  return label(name);
}

/** "D. 4 MIN ON X 1'30 MIN OFF X 5 RONDAS:" → "4 MIN ON X 1'30 MIN OFF X 5 RONDAS". */
const sectionName = (line: string) => label(line.replace(/^[A-Z]\s*\.\s*/, "").replace(/:+$/, ""));

/** The leading reps of a line: "4 BACK SQUAT" → 4 ("10+10 …" has no single count). */
function leadingReps(line: string): number | undefined {
  const match = line.replace(/^[A-Z]\s*:\s*/, "").match(/^(\d+)\s+[A-Z]/i);
  return match ? Number(match[1]) : undefined;
}

/** Series of a lift: its SERIES column, else the section's "X 6 RONDAS", else 3. */
function seriesOf(exercise: Exercise, header: string | undefined): number {
  const fromColumn = parseInt(exercise.sets ?? "", 10);
  const fromHeader = header?.match(/X\s*(\d+)\s*RONDAS/i)?.[1];
  const count = Number.isFinite(fromColumn) ? fromColumn : fromHeader ? Number(fromHeader) : 3;
  return Math.min(Math.max(count, 1), MAX_SETS);
}

// "4 BACK SQUAT", "A: 10 PUSH PRESS": a movement starts with its reps (a coach's note never does).
const STARTS_WITH_REPS = /^(?:[A-Z]\s*:\s*)?\d+(?:\s*\+\s*\d+)*\s+[A-ZÁÉÍÓÚÑ]/i;
// "EMOM X 15 MIN", "E2MO2M X 6 RONDAS", "E1:30M X 6 RONDAS": work on the clock, usually one lift.
const INTERVAL = /\b(?:EMOM|E\d+(?::\d+)?M(?:O\d*M)?|E\d+M\d*OM)\b/i;

type Section = { header?: Exercise; items: Exercise[]; scoredBlock: boolean; unscoredBlock: boolean };

const isMovement = (exercise: Exercise) => !isSectionHeader(exercise.name) && STARTS_WITH_REPS.test(exercise.name.trim()) && liftName(exercise.name) !== "";

/**
 * A line with a % or RPE; or the only movement of an interval part ("E2MO2M X 6 RONDAS: 1 POWER
 * CLEAN"), unless the part is an activation or accessory work (its one movement is a drill).
 */
function isLift(exercise: Exercise, section: Section): boolean {
  if (!isMovement(exercise)) return false;
  if (exercise.target || INLINE_EFFORT.test(exercise.name)) return true;
  return Boolean(section.header && !section.unscoredBlock && INTERVAL.test(section.header.name) && section.items.filter(isMovement).length === 1);
}

// A part that is scored ("FOR TIME", "AMRAP 12", "EMOM X 40 MIN", "4 MIN ON X 1'30 OFF", "MAX REPS").
const SCORED = /\bFOR TIME\b|\bAMRAP\b|\bRFT\b|\bEMOM\b|\bTABATA\b|\bCHIPPER\b|\bMAX\b|\bON X\b|\bRM\b/i;
// Blocks named as the day's conditioning piece are scored whatever their first line says.
const WOD_BLOCK = /WORKOUT|\bWOD\b|METCON|CONDITIONING/i;
// …and those for preparing or practicing never are ("MAX SEG HOLD" in an activation isn't a score).
const UNSCORED_BLOCK = /ACTIVACI|MOVILIDAD|ACCESORIO|ESTRUCTURA|GYMNASTIC|SKILL|T[EÉ]CNICA/i;
// "40-30-20-10", "21-15-9": a rep scheme, not a name.
const REP_SCHEME = /^[\d\s\-–+]+$/;


/**
 * A block's parts. The coach writes them two ways: lettered sections inside a block ("A. 3 RONDAS:",
 * "B. E3MO3M X 6 RONDAS:"), or one part per block (ACTIVACIÓN, FUERZA…) headed by its first line
 * ("E3MO3M X 5 RONDAS:"). Lines before the first lettered header form a part without a header.
 */
function sectionsOf(exercises: Exercise[], title: string): Section[] {
  const scoredBlock = WOD_BLOCK.test(title);
  const unscoredBlock = !scoredBlock && UNSCORED_BLOCK.test(title);
  if (exercises.some((e) => isSectionHeader(e.name))) {
    const sections: Section[] = [{ items: [], scoredBlock, unscoredBlock }];
    for (const exercise of exercises) {
      if (isSectionHeader(exercise.name)) sections.push({ header: exercise, items: [], scoredBlock, unscoredBlock });
      else sections[sections.length - 1].items.push(exercise);
    }
    return sections;
  }
  const [first, ...rest] = exercises;
  if (!first) return [];
  // "4 BACK SQUAT" on top is a movement, not the part's header.
  return isMovement(first) ? [{ items: exercises, scoredBlock, unscoredBlock }] : [{ header: first, items: rest, scoredBlock, unscoredBlock }];
}

/** "FOR TIME · ONE ARM DB PUSH PRESS": the part's header and its first line that names something. */
function wodName(section: Section): string {
  const clean = (line: string) => label(line.replace(/https?:\/\/\S+/g, "").replace(/\([^)]*\)/g, "").replace(/[:.]+$/, ""));
  const first = section.items.map((e) => clean(e.name)).find((line) => line && !REP_SCHEME.test(line));
  return [sectionName(section.header!.name), first].filter(Boolean).join(" · ").slice(0, 80);
}

/**
 * The day's loggable lines, keyed by the Exercise object they come from (ids follow the day's line
 * order). The warm-up isn't logged; a part with a lift is logged through its lifts, and a scored
 * part (FOR TIME, AMRAP, EMOM…, or the block called WORKOUT OF THE DAY) gets one result.
 */
export function loggableItems(workout: Workout): Map<Exercise, LoggableItem> {
  const items = new Map<Exercise, LoggableItem>();
  const ids = new Map<Exercise, number>();
  workout.blocks.flatMap((b) => b.exercises).forEach((exercise, i) => ids.set(exercise, i));

  for (const block of workout.blocks) {
    if (label(block.title) === WARM_UP) continue;
    for (const section of sectionsOf(block.exercises, block.title)) {
      const lifts = section.items.filter((e) => isLift(e, section));
      for (const exercise of lifts) {
        items.set(exercise, {
          kind: "lift",
          id: `l${ids.get(exercise)}`,
          exercise: liftName(exercise.name),
          sets: seriesOf(exercise, section.header?.name),
          reps: leadingReps(exercise.name),
        });
      }
      const text = [section.header, ...section.items].map((e) => e?.name ?? "").join("\n");
      if (section.header && !lifts.length && !section.unscoredBlock && (section.scoredBlock || SCORED.test(text))) {
        items.set(section.header, { kind: "wod", id: `w${ids.get(section.header)}`, name: wodName(section) });
      }
    }
  }
  return new Map([...items].sort(([a], [b]) => ids.get(a)! - ids.get(b)!));
}

/** FNV-1a, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const slug = (text: string) => label(text).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "X";

/**
 * The log's document id: week, day and the day's content. The coach rewrites the shared plan every
 * cycle with the same "SEMANA 2 · DIA 1" labels, so new content starts a new, empty log.
 */
export function crossfitLogKey(workout: Workout): string {
  const content = workout.blocks.flatMap((b) => [b.title, ...b.exercises.map((e) => `${e.name}|${e.sets ?? ""}|${e.reps ?? ""}|${e.target ?? ""}`)]).join("\n");
  return `${slug(workout.week)}__${slug(workout.day)}__${hash(content)}`;
}

// --- Scores ---

/** "4:35" for a time, "5 + 12" for rounds and reps, "120 reps". */
export function formatScore(score: WodScore): string {
  if (score.type === "time") {
    const total = Math.round(score.seconds ?? 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  }
  if (score.type === "rounds") return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
  return `${score.reps ?? 0} reps`;
}

/** A score that makes sense, or an error message. */
export function validScore(score: WodScore): string | null {
  const whole = (n: number | undefined, max: number) => n === undefined || (Number.isInteger(n) && n >= 0 && n <= max);
  if (score.type === "time") return score.seconds && score.seconds > 0 && score.seconds < 6 * 3600 ? null : "Cargá un tiempo, por ejemplo 12:30.";
  if (score.type === "rounds") {
    if (!whole(score.rounds, 1000) || !whole(score.reps, 1000) || !(score.rounds || score.reps)) return "Cargá las rondas y las reps extra.";
    return null;
  }
  return score.reps && whole(score.reps, 10000) ? null : "Cargá las reps totales.";
}

// --- Logs → history ---

const UNITS: Record<WodScoreType, string> = { time: "TIEMPO", rounds: "RONDAS", reps: "REPS" };

/** Every series and WOD result as history records ("at" is Argentina's local time, like REGISTRO). */
export function crossfitRecords(logs: CrossfitLog[]): HistoryRecord[] {
  const records: HistoryRecord[] = [];
  for (const log of logs) {
    for (const entry of Object.values(log.entries)) {
      if (entry.kind === "lift") {
        for (const set of entry.sets) {
          if (set.load === undefined && set.reps === undefined) continue;
          records.push({
            exercise: entry.exercise,
            at: set.at,
            date: set.at.slice(0, 10),
            set: set.set,
            load: set.load,
            reps: set.reps,
            result: String(set.load ?? set.reps),
            unit: set.load !== undefined ? "KG" : "REPS",
          });
        }
      } else {
        const { score } = entry;
        records.push({
          exercise: label(entry.name),
          at: entry.at,
          date: entry.at.slice(0, 10),
          reps: score.type === "reps" ? score.reps : undefined,
          result: score.type === "rounds" ? `${score.rounds ?? 0}+${score.reps ?? 0}` : formatScore(score).replace(" reps", ""),
          unit: UNITS[score.type],
        });
      }
    }
  }
  return records;
}

/**
 * History entries for what was logged in CrossFit and isn't in the athlete's catalog: lifts are
 * measured like the catalog's strength exercises (load × reps, with E1RM), WODs by their score.
 */
export function crossfitCatalog(logs: CrossfitLog[], known: Set<string>): CatalogExercise[] {
  const found = new Map<string, CatalogExercise>();
  for (const log of logs) {
    for (const entry of Object.values(log.entries)) {
      const key = label(entry.kind === "lift" ? entry.exercise : entry.name);
      // A lift whose series were all cleared again leaves nothing to show.
      if (known.has(key) || found.has(key) || (entry.kind === "lift" && !entry.sets.length)) continue;
      if (entry.kind === "lift") {
        found.set(key, { key, name: key, category: "CROSSFIT", measurement: "LOAD_REPS", better: "HIGHER", withE1rm: true, withBodyWeight: true });
      } else {
        const measurement = entry.score.type === "time" ? "TIME" : entry.score.type === "rounds" ? "ROUNDS" : "REPS";
        found.set(key, { key, name: key, category: "WOD", measurement, better: measurement === "TIME" ? "LOWER" : "HIGHER", withE1rm: false, withBodyWeight: false });
      }
    }
  }
  return [...found.values()];
}
