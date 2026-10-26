/** What the phone receives. Values are shown as the coach wrote them ("10+10", "RPE 8", "2 MIN"). */
export type Exercise = {
  name: string;
  order?: string;
  sets?: string;
  reps?: string;
  target?: string;
  rest?: string;
  interval?: string;
  notes?: string;
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
