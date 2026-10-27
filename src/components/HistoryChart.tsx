"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Metric } from "@/lib/history";
import { dayNumber, formatLongDate, formatMetric, formatShortDate, formatTick } from "./history-format";

export type ChartPoint = { date: string; value: number };

const HEIGHT = 190;
const PAD = { top: 12, right: 14, bottom: 26, left: 44 };
// Past this many points the dots get in each other's way: only the selected one is drawn.
const MAX_DOTS = 40;

/** About 4 round tick values covering [min, max]. */
function ticks(min: number, max: number, metric: Metric): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / 4;
  const steps = metric === "time" ? [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] : undefined;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    steps?.find((s) => s >= raw) ?? [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const first = Math.floor(min / step) * step;
  const result: number[] = [];
  for (let v = first; v <= max + step * 0.999; v += step) result.push(Number(v.toFixed(6)));
  return result;
}

/**
 * One series over time (oldest left). Tap or drag across it to read a day's value and date;
 * arrow keys do the same when it has focus. Starts on the latest point (remount it with a `key`
 * to start over for another exercise or metric).
 */
export function HistoryChart({ points, metric, label }: { points: ChartPoint[]; metric: Metric; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [active, setActive] = useState(points.length - 1);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const days = points.map((p) => dayNumber(p.date));
  const values = points.map((p) => p.value);
  const yTicks = ticks(Math.min(...values), Math.max(...values), metric);
  const [yMin, yMax] = [yTicks[0], yTicks[yTicks.length - 1]];
  const [xMin, xMax] = [days[0], days[days.length - 1]];
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const x = (day: number) => PAD.left + (xMax === xMin ? plotWidth / 2 : ((day - xMin) / (xMax - xMin)) * plotWidth);
  const y = (value: number) => PAD.top + (yMax === yMin ? plotHeight / 2 : (1 - (value - yMin) / (yMax - yMin)) * plotHeight);
  const coords = points.map((p, i) => [x(days[i]), y(p.value)] as const);
  const line = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)},${cy.toFixed(1)}`).join("");
  const area = `${line}L${coords[coords.length - 1][0].toFixed(1)},${PAD.top + plotHeight}L${coords[0][0].toFixed(1)},${PAD.top + plotHeight}Z`;

  const selected = points[Math.min(active, points.length - 1)];
  const [sx, sy] = coords[Math.min(active, coords.length - 1)];

  function pick(event: PointerEvent<SVGSVGElement>) {
    const left = event.currentTarget.getBoundingClientRect().left;
    const px = event.clientX - left;
    let nearest = 0;
    coords.forEach(([cx], i) => {
      if (Math.abs(cx - px) < Math.abs(coords[nearest][0] - px)) nearest = i;
    });
    setActive(nearest);
  }

  function step(event: KeyboardEvent) {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -points.length, End: points.length }[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((i) => Math.min(Math.max(i + move, 0), points.length - 1));
  }

  // First and last date always; the point nearest the middle too when it doesn't crowd them.
  const middle = coords.reduce((best, [cx], i) => (Math.abs(cx - (PAD.left + plotWidth / 2)) < Math.abs(coords[best][0] - (PAD.left + plotWidth / 2)) ? i : best), 0);
  const xLabels = [0, middle, points.length - 1]
    .filter((i, n, list) => list.indexOf(i) === n)
    .filter((i) => i === 0 || i === points.length - 1 || Math.min(coords[i][0] - coords[0][0], coords[points.length - 1][0] - coords[i][0]) > 56)
    .map((i) => ({ i, cx: coords[i][0] }));

  return (
    <div>
      <p aria-live="polite" className="flex items-baseline justify-between gap-3">
        <span className="font-display text-3xl font-extrabold tabular-nums">{formatMetric(metric, selected.value)}</span>
        <span className="text-sm text-muted">{formatLongDate(selected.date)}</span>
      </p>
      <div ref={box} className="mt-2 w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label}: ${points.length} registros. Usá las flechas para recorrerlos.`}
          tabIndex={0}
          onPointerDown={pick}
          onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && pick(e)}
          onKeyDown={step}
          className="block touch-pan-y rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <defs>
            <linearGradient id="history-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {formatTick(metric, t)}
              </text>
            </g>
          ))}
          {xLabels.map(({ i, cx }) => (
            <text
              key={i}
              x={cx}
              y={HEIGHT - 6}
              textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {formatShortDate(points[i].date)}
            </text>
          ))}

          {points.length > 1 && <path d={area} fill="url(#history-area)" />}
          {points.length > 1 && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {points.length <= MAX_DOTS &&
            coords.map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="4" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
            ))}

          <line x1={sx} x2={sx} y1={PAD.top} y2={PAD.top + plotHeight} stroke="var(--silver)" strokeOpacity="0.5" strokeDasharray="3 3" />
          <circle cx={sx} cy={sy} r="6.5" fill="var(--accent)" stroke="var(--foreground)" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
