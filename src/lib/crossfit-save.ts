import type { Athlete } from "./athletes";
import { getCrossfitPlan } from "./crossfit";
import { crossfitLogKey, crossfitRecords, loggableItems, validScore, type WodScore } from "./crossfit-log";
import { getCrossfitLog, listCrossfitLogs, saveCrossfitSets, saveCrossfitWod } from "./firestore";
import { parseHistoryRecords } from "./history";
import { formatRecordedAt, personalRecordOver, REGISTRO_RANGE, ResultError, type PersonalRecord, type SetResult } from "./results";
import { readRange } from "./sheets";
import { MAX_NOTE_LENGTH, MAX_SETS } from "./types";

/**
 * Saving what an athlete logs on a CrossFit day (in Firestore). The day and the line are looked up
 * again in the shared plan, so the browser only says which line, never what it's called.
 */

const label = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

/** "2026-11-21T10:05:00", Argentina's local time like REGISTRO's FECHA. */
const now = () => formatRecordedAt(new Date()).replace(" ", "T");

async function findItem(day: string, id: string) {
  const plan = await getCrossfitPlan(day);
  if (!plan || plan.selectedDay !== label(day)) throw new ResultError("Este día ya no está en la planificación. Actualizá la página.");
  const entry = [...loggableItems(plan.workout)].find(([, item]) => item.id === id);
  if (!entry) throw new ResultError("Esta parte del día cambió. Actualizá la página.");
  const [exercise, item] = entry;
  return { workout: plan.workout, key: crossfitLogKey(plan.workout), exercise, item };
}

/** Every earlier series of a lift: from the athlete's own sheet and from CrossFit logs. */
async function liftHistory(athlete: Athlete, exercise: string): Promise<Pick<SetResult, "load" | "reps">[]> {
  const [registro, logs] = await Promise.all([
    athlete.spreadsheetId ? readRange(athlete.spreadsheetId, REGISTRO_RANGE).catch(() => []) : Promise.resolve([]),
    listCrossfitLogs(athlete.id),
  ]);
  const sheet = registro.length ? parseHistoryRecords(registro, athlete.id) : [];
  return [...sheet, ...crossfitRecords(logs)].filter((r) => r.exercise === exercise);
}

export type CrossfitSetsInput = { day: string; entry: string; sets: SetResult[]; note?: string };

/** Saves series of a CrossFit lift (empty ones are deleted). Returns a PR when one was beaten. */
export async function saveCrossfitLift(athlete: Athlete, input: CrossfitSetsInput): Promise<{ record?: PersonalRecord }> {
  const valid = (n: number | undefined) => n === undefined || (Number.isFinite(n) && n >= 0 && n <= 1000);
  if (!Array.isArray(input.sets) || !input.sets.every((s) => Number.isInteger(s.set) && s.set >= 1 && s.set <= MAX_SETS && valid(s.load) && valid(s.reps))) {
    throw new ResultError("Revisá los valores cargados.");
  }
  const note = input.note?.trim().replace(/\r\n/g, "\n");
  if (note && note.length > MAX_NOTE_LENGTH) throw new ResultError(`La nota puede tener hasta ${MAX_NOTE_LENGTH} caracteres.`);

  const { workout, key, exercise, item } = await findItem(input.day, input.entry);
  if (item.kind !== "lift") throw new ResultError("Esta parte del día cambió. Actualizá la página.");

  const [saved, before] = await Promise.all([getCrossfitLog(athlete.id, key), liftHistory(athlete, item.exercise)]);
  const current = saved?.entries[item.id];
  const previous = current?.kind === "lift" ? current.sets : [];
  const at = now();
  const sets = input.sets.map((s) => {
    const old = previous.find((p) => p.set === s.set);
    // A series keeps the moment it was first done (editing it later doesn't move it to another day).
    return { ...s, at: old && old.load === s.load && old.reps === s.reps ? old.at : (old?.at ?? at) };
  });
  // Only series that changed; an unchanged note isn't written again.
  const changed = sets.filter((s) => {
    const old = previous.find((p) => p.set === s.set);
    return old ? old.load !== s.load || old.reps !== s.reps : s.load !== undefined || s.reps !== undefined;
  });
  const noteChanged = note !== undefined && note !== (current?.kind === "lift" ? (current.note ?? "") : "");
  if (!changed.length && !noteChanged) return {};

  await saveCrossfitSets(athlete.id, key, workout, { id: item.id, exercise: item.exercise, line: exercise.name }, changed, noteChanged ? note : undefined);
  return { record: personalRecordOver(before, item.exercise, changed) };
}

export type CrossfitWodInput = { day: string; entry: string; score: WodScore | null; rx?: boolean; note?: string };

/** Saves a WOD's result, or deletes it (score null). */
export async function saveCrossfitResult(athlete: Athlete, input: CrossfitWodInput) {
  const { workout, key, item } = await findItem(input.day, input.entry);
  if (item.kind !== "wod") throw new ResultError("Esta parte del día cambió. Actualizá la página.");
  if (!input.score) return saveCrossfitWod(athlete.id, key, workout, item.id, null);

  const { type, seconds, rounds, reps } = input.score;
  if (type !== "time" && type !== "rounds" && type !== "reps") throw new ResultError("Elegí cómo se mide el resultado.");
  const score: WodScore =
    type === "time" ? { type, seconds: Number(seconds) } : type === "rounds" ? { type, rounds: Number(rounds ?? 0), reps: Number(reps ?? 0) } : { type, reps: Number(reps) };
  const error = validScore(score);
  if (error) throw new ResultError(error);
  const note = input.note?.trim().replace(/\r\n/g, "\n").slice(0, MAX_NOTE_LENGTH);

  const saved = await getCrossfitLog(athlete.id, key);
  const old = saved?.entries[item.id];
  await saveCrossfitWod(athlete.id, key, workout, item.id, {
    name: item.name,
    score,
    rx: input.rx !== false,
    note: note || undefined,
    at: old?.kind === "wod" ? old.at : now(),
  });
}
