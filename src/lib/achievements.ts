import type { Goals } from "./goals";
import type { ExerciseHistory, HistoryRecord, Metric } from "./history";

/**
 * Streaks, sessions, personal records and badges, worked out from the athlete's
 * REGISTRO_PLANIFICACION (the sheet stays the one source of truth). Pure functions.
 */

/** A day on which an exercise's best beat every earlier day. */
export type RecordEvent = { exercise: string; name: string; date: string; value: number; previous: number; metric: Metric };

export type Badge = {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  /** Toward the badge (shown as a bar while it isn't earned). */
  current: number;
  target: number;
};

export type LiftProgress = { exercise: string; name: string; targetKg: number; bestKg: number; reached: boolean };

export type Achievements = {
  /** Distinct days with anything logged. */
  sessions: number;
  /** Days trained this week (Monday to Sunday) and on which weekdays (0 = Monday). */
  thisWeek: { days: number; weekdays: number[] };
  /** Consecutive weeks meeting the weekly goal, up to this one (still open, so it doesn't break it). */
  streak: number;
  bestStreak: number;
  records: number;
  /** Newest first. */
  recentRecords: RecordEvent[];
  lifts: LiftProgress[];
  badges: Badge[];
};

const DAY_MS = 86_400_000;
const toTime = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Monday of the date's week, "2026-11-16" for any day from 16 to 22 Nov 2026. */
export function weekOf(date: string): string {
  const time = toTime(date);
  const weekday = (new Date(time).getUTCDay() + 6) % 7;
  return toDate(time - weekday * DAY_MS);
}

/** Every time an exercise's daily best beat all earlier days (the first day is the baseline, not a record). */
export function recordEvents(history: ExerciseHistory[]): RecordEvent[] {
  const events: RecordEvent[] = [];
  for (const exercise of history) {
    let best: number | undefined;
    for (const day of [...exercise.days].sort((a, b) => a.date.localeCompare(b.date))) {
      const better = best === undefined ? false : exercise.better === "HIGHER" ? day.value > best : day.value < best;
      if (better) events.push({ exercise: exercise.key, name: exercise.name, date: day.date, value: day.value, previous: best!, metric: exercise.metric });
      if (best === undefined || better) best = day.value;
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

/** Weeks in a row (newest backwards) with at least `goal` training days; this week counts only once met. */
export function weekStreaks(dates: string[], goal: number, today: string): { streak: number; best: number } {
  const perWeek = new Map<string, number>();
  for (const date of new Set(dates)) perWeek.set(weekOf(date), (perWeek.get(weekOf(date)) ?? 0) + 1);
  const met = (week: string) => (perWeek.get(week) ?? 0) >= goal;

  const current = weekOf(today);
  let week = met(current) ? current : toDate(toTime(current) - 7 * DAY_MS);
  let streak = 0;
  while (met(week)) {
    streak++;
    week = toDate(toTime(week) - 7 * DAY_MS);
  }

  let best = 0;
  let run = 0;
  let previous: number | undefined;
  for (const w of [...perWeek.keys()].filter(met).sort()) {
    const time = toTime(w);
    run = previous !== undefined && time - previous === 7 * DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    previous = time;
  }
  return { streak, best: Math.max(best, streak) };
}

type BadgeRule = { id: string; icon: string; title: string; description: string; target: number; of: "sessions" | "streak" | "records" | "lifts" };

const BADGES: BadgeRule[] = [
  { id: "sesion-1", icon: "🚀", title: "Primer paso", description: "Tu primer entrenamiento cargado", target: 1, of: "sessions" },
  { id: "sesiones-10", icon: "💪", title: "Constancia", description: "10 entrenamientos", target: 10, of: "sessions" },
  { id: "sesiones-25", icon: "🔩", title: "Hecho en La Fábrica", description: "25 entrenamientos", target: 25, of: "sessions" },
  { id: "sesiones-50", icon: "⚙️", title: "Engranaje", description: "50 entrenamientos", target: 50, of: "sessions" },
  { id: "sesiones-100", icon: "🏭", title: "Máquina", description: "100 entrenamientos", target: 100, of: "sessions" },
  { id: "racha-2", icon: "🔥", title: "En llamas", description: "2 semanas seguidas cumpliendo tu objetivo", target: 2, of: "streak" },
  { id: "racha-4", icon: "📅", title: "Un mes firme", description: "4 semanas seguidas", target: 4, of: "streak" },
  { id: "racha-8", icon: "🧱", title: "Hábito", description: "8 semanas seguidas", target: 8, of: "streak" },
  { id: "racha-12", icon: "👑", title: "Imparable", description: "12 semanas seguidas", target: 12, of: "streak" },
  { id: "pr-1", icon: "🏆", title: "Primer PR", description: "Superaste tu mejor marca", target: 1, of: "records" },
  { id: "pr-10", icon: "🥇", title: "Coleccionista", description: "10 PRs", target: 10, of: "records" },
  { id: "pr-25", icon: "💎", title: "Leyenda", description: "25 PRs", target: 25, of: "records" },
  { id: "objetivo-1", icon: "🎯", title: "Objetivo cumplido", description: "Llegaste a una carga objetivo", target: 1, of: "lifts" },
];

export function buildAchievements({ records, history, goals, today }: { records: HistoryRecord[]; history: ExerciseHistory[]; goals: Goals; today: string }): Achievements {
  const dates = [...new Set(records.map((r) => r.date))];
  const week = weekOf(today);
  const weekDates = dates.filter((d) => weekOf(d) === week);
  const { streak, best } = weekStreaks(dates, goals.weeklyDays, today);
  const events = recordEvents(history);

  const byKey = new Map(history.map((e) => [e.key, e]));
  const lifts = goals.lifts.map((goal) => {
    const exercise = byKey.get(goal.exercise);
    const bestKg = exercise?.summary.bestLoad ?? 0;
    return { exercise: goal.exercise, name: exercise?.name ?? goal.exercise, targetKg: goal.targetKg, bestKg, reached: bestKg >= goal.targetKg };
  });

  const totals = { sessions: dates.length, streak: best, records: events.length, lifts: lifts.filter((l) => l.reached).length };
  const badges = BADGES.map(({ of, ...rule }) => ({ ...rule, current: Math.min(totals[of], rule.target), earned: totals[of] >= rule.target }));

  return {
    sessions: dates.length,
    thisWeek: { days: weekDates.length, weekdays: weekDates.map((d) => (new Date(toTime(d)).getUTCDay() + 6) % 7) },
    streak,
    bestStreak: best,
    records: events.length,
    recentRecords: events.slice(0, 5),
    lifts,
    badges,
  };
}

/** Badges earned now that weren't stored yet: these get celebrated, then stored with today's date. */
export function newBadges(badges: Badge[], stored: Record<string, string>): Badge[] {
  return badges.filter((b) => b.earned && !stored[b.id]);
}
