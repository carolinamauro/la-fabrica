"use client";

import { useState, type ReactNode } from "react";
import type { ExerciseHistory, Metric } from "@/lib/history";
import { ExercisePicker } from "./ExercisePicker";
import { HistoryChart } from "./HistoryChart";
import { HistoryDays } from "./HistoryDays";
import {
  formatDate,
  formatKg,
  formatMetric,
  formatPercent,
  formatRatio,
  HISTORY_COOKIE,
  METRIC_LABELS,
} from "./history-format";

/** `sub`: a secondary number shown under the value (the E1RM under the best load). */
type Card = { label: string; value: string; hint?: string; sub?: { label: string; value: string } };

/** The headline numbers that make sense for how the exercise is measured. */
function summaryCards({ metric, summary, days }: ExerciseHistory): Card[] {
  const cards: Card[] = [];
  // The heaviest load actually lifted leads; the estimated 1RM goes under it.
  const estimated = metric === "e1rm" && summary.bestE1rm !== undefined ? { label: "E1RM estimado", value: formatKg(summary.bestE1rm) } : undefined;
  if (summary.bestLoad !== undefined) {
    cards.push({ label: "Mejor carga", value: formatKg(summary.bestLoad), hint: "lo más pesado que levantaste", sub: estimated });
  } else if (estimated) {
    cards.push(estimated);
  }
  if (metric === "reps" && summary.best !== undefined) cards.push({ label: "Mejores reps", value: formatMetric("reps", summary.best) });
  if (metric === "time" && summary.best !== undefined) cards.push({ label: "Mejor tiempo", value: formatMetric("time", summary.best) });
  if (summary.ratio !== undefined) cards.push({ label: "Ratio BW", value: formatRatio(summary.ratio), hint: "E1RM / peso corporal" });
  // With a single day there's nothing to compare yet.
  if (summary.progress !== undefined && days.length > 1) {
    cards.push({ label: "Progreso", value: formatPercent(summary.progress), hint: metric === "time" ? "menos tiempo que el primero" : "desde el primer registro" });
  }
  if (summary.lastAt) cards.push({ label: "Último registro", value: formatDate(summary.lastAt) });
  return cards;
}

function SummaryCards({ cards }: { cards: Card[] }) {
  const [headline, ...rest] = cards;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {/* The first card is the exercise's main number, full width. */}
      <div className="col-span-2 rounded-2xl border border-line border-l-4 border-l-accent bg-card px-4 py-3">
        <dt className="font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">{headline.label}</dt>
        <dd className="font-display text-5xl leading-none font-extrabold tabular-nums">{headline.value}</dd>
        {headline.hint && <dd className="mt-1 text-xs text-muted">{headline.hint}</dd>}
        {headline.sub && (
          <dd className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <span className="text-xs font-semibold tracking-widest text-muted uppercase">{headline.sub.label}</span>
            <span className="font-display text-2xl font-bold text-silver tabular-nums">{headline.sub.value}</span>
          </dd>
        )}
      </div>
      {rest.map((card, i) => (
        <div key={card.label} className={`rounded-2xl border border-line bg-card px-3 py-2.5 ${rest.length % 2 && i === rest.length - 1 ? "col-span-2" : ""}`}>
          <dt className="text-xs font-semibold tracking-widest text-muted uppercase">{card.label}</dt>
          <dd className="font-display text-2xl leading-tight font-bold tabular-nums">{card.value}</dd>
          {card.hint && <dd className="text-xs text-muted">{card.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-5 text-center">
      <p className="font-display text-xl font-bold uppercase">{title}</p>
      {children && <p className="mt-1 text-muted">{children}</p>}
    </div>
  );
}

function rememberExercise(key: string) {
  try {
    document.cookie = `${HISTORY_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // Remembering is a convenience: without cookies the latest trained exercise opens.
  }
}

/** Historial: exercise picker, headline numbers, evolution chart and the day-by-day log. */
export function HistoryView({ history, initial }: { history: ExerciseHistory[]; initial: string }) {
  const [selectedKey, setSelectedKey] = useState(initial);
  const [chartMetric, setChartMetric] = useState<Metric | null>(null);
  const exercise = history.find((e) => e.key === selectedKey) ?? history[0];

  function select(key: string) {
    setSelectedKey(key);
    setChartMetric(null);
    rememberExercise(key);
    window.scrollTo({ top: 0 });
  }

  // Strength with E1RM charts the day's heaviest load first, and can switch to the E1RM.
  const metrics: Metric[] = exercise.metric === "e1rm" ? ["load", "e1rm"] : [exercise.metric];
  const metric = chartMetric && metrics.includes(chartMetric) ? chartMetric : metrics[0];
  const points = exercise.days
    .map((day) => ({ date: day.date, value: metric === "load" && exercise.metric !== "load" ? (day.topLoad ?? day.best.load ?? 0) : day.value }))
    .reverse();
  const cards = summaryCards(exercise);

  return (
    <>
      <ExercisePicker
        items={history.map((e) => ({ key: e.key, name: e.name, category: e.category, lastAt: e.summary.lastAt, days: e.days.length }))}
        selected={{ key: exercise.key, name: exercise.name, category: exercise.category, lastAt: exercise.summary.lastAt, days: exercise.days.length }}
        onSelect={select}
      />

      {!exercise.summary.lastAt ? (
        <Empty title="Sin registros todavía">Cuando cargues {exercise.name.toLowerCase()} en tu plan, vas a ver acá tu evolución.</Empty>
      ) : (
        <>
          {cards.length > 0 && <SummaryCards cards={cards} />}

          {points.length ? (
            <section aria-label="Evolución" className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">Evolución</h2>
                {metrics.length > 1 ? (
                  <div role="group" aria-label="Valor del gráfico" className="flex rounded-lg border border-line p-0.5">
                    {metrics.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={m === metric}
                        onClick={() => setChartMetric(m)}
                        className={`h-8 rounded-md px-3 font-display text-sm font-bold tracking-wider uppercase ${
                          m === metric ? "bg-accent text-background" : "text-muted"
                        }`}
                      >
                        {METRIC_LABELS[m]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted">
                    {METRIC_LABELS[metric]}
                    {exercise.better === "LOWER" && " · menor es mejor"}
                  </span>
                )}
              </div>
              <HistoryChart key={`${exercise.key}-${metric}`} points={points} metric={metric} label={`${exercise.name}, ${METRIC_LABELS[metric]}`} />
            </section>
          ) : (
            <Empty title="Nada para graficar">
              {exercise.metric === "e1rm" ? "Cargá carga y repeticiones en una misma serie para calcular tu E1RM." : "Todavía no hay resultados completos."}
            </Empty>
          )}

          {exercise.days.length > 0 && <HistoryDays key={exercise.key} exercise={exercise} />}
        </>
      )}
    </>
  );
}
