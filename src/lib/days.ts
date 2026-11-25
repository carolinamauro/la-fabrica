import type { DaySelection, WeekSummary } from "./types";

/**
 * The day to open in another week: the same day (Día 3 → Día 3); if that week names its days
 * differently, the one in the same place (its third day); else its last.
 */
export function sameDayIn(week: WeekSummary, from: DaySelection, weeks: WeekSummary[]): DaySelection {
  if (week.days.includes(from.day)) return { week: week.week, day: from.day };
  const position = weeks.find((w) => w.week === from.week)?.days.indexOf(from.day) ?? 0;
  return { week: week.week, day: week.days[Math.min(Math.max(position, 0), week.days.length - 1)] };
}
