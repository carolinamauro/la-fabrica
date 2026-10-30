/** What the phone receives. Values are shown as the coach wrote them ("10+10", "RPE 8", "2 MIN"). */
import type { ExerciseVideo } from "./video";

export type Exercise = {
  name: string;
  order?: string;
  sets?: string;
  reps?: string;
  target?: string;
  rest?: string;
  interval?: string;
  notes?: string;
  /** How the exercise is done, from the LINKS column. */
  video?: ExerciseVideo;
};

export type Block = {
  title: string;
  /** Free-text lines that are not individual exercises (e.g. a WOD description). */
  lines: string[];
  exercises: Exercise[];
};

export type Workout = { week: string; day: string; blocks: Block[] };

export type WeekSummary = { week: string; days: string[] };

export type DaySelection = { week: string; day: string };

// MI_PLANIFICACION has 6 SERIE groups (Carga + Reps, columns I–T).
// Lives here, not in results.ts, so client components can use it without bundling the Sheets client.
export const MAX_SETS = 6;
/** Longest note the athlete can leave on an exercise (NOTAS ALUMNO). */
export const MAX_NOTE_LENGTH = 500;
