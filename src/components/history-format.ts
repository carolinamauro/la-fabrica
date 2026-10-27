import type { Metric } from "@/lib/history";

/** Remembers the last exercise opened in Historial (read by the page to open it again). */
export const HISTORY_COOKIE = "lafabrica_historial";

// Formatted by hand, not with Intl, so the server and the phone render exactly the same text.
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** 60.5 → "60,5"; 56.6667 → "56,67" (up to `digits` decimals, no trailing zeros). */
export function formatNumber(value: number, digits = 2): string {
  return String(Number(value.toFixed(digits))).replace(".", ",");
}

export const formatKg = (value: number) => `${formatNumber(value, 1)} kg`;

export const formatRatio = (value: number) => value.toFixed(2).replace(".", ",");

/** +6,76 % (with a real minus sign when negative). */
export function formatPercent(value: number): string {
  const sign = value > 0.005 ? "+" : value < -0.005 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), 2)} %`;
}

/** 275 → "4:35"; 3875 → "1:04:35". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const parts = (date: string) => date.slice(0, 10).split("-").map(Number) as [number, number, number];

/** Days since 1970 of a "2026-10-01" date (for the chart's time axis). */
export const dayNumber = (date: string) => {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** "2026-10-01" → "01/10/2026". */
export function formatDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "2026-10-01" → "1 oct". */
export function formatShortDate(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2026-10-01" → "jue 1 oct 2026". */
export function formatLongDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export const METRIC_LABELS: Record<Metric, string> = { e1rm: "E1RM", load: "Carga máx.", reps: "Reps", time: "Tiempo" };

export function formatMetric(metric: Metric, value: number): string {
  if (metric === "time") return formatDuration(value);
  if (metric === "reps") return `${formatNumber(value, 1)} reps`;
  return formatKg(value);
}

/** Axis labels: no unit, to keep them short. */
export const formatTick = (metric: Metric, value: number) => (metric === "time" ? formatDuration(value) : formatNumber(value, 1));
