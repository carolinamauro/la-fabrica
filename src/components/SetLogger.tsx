"use client";

import { useState } from "react";
import { saveSetsAction } from "@/app/actions";
import type { SetResult } from "@/lib/results";

type Row = { load: string; reps: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

type Props = {
  week: string;
  day: string;
  name: string;
  order?: string;
  setCount: number;
  saved: SetResult[];
};

const toText = (value: number | undefined) => (value === undefined ? "" : String(value));

function parse(value: string): number | undefined | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Carga + Reps per series (like MI_PLANIFICACION columns I–T), saved to the athlete's sheet. */
export function SetLogger({ week, day, name, order, setCount, saved }: Props) {
  const initial = Array.from({ length: setCount }, (_, i) => {
    const entry = saved.find((s) => s.set === i + 1);
    return { load: toText(entry?.load), reps: toText(entry?.reps) };
  });
  const [rows, setRows] = useState<Row[]>(initial);
  const [lastSaved, setLastSaved] = useState<Row[]>(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const dirty = rows.some((row, i) => row.load !== lastSaved[i].load || row.reps !== lastSaved[i].reps);

  function update(index: number, field: keyof Row, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  }

  async function save() {
    const sets: SetResult[] = [];
    for (const [i, row] of rows.entries()) {
      const load = parse(row.load);
      const reps = parse(row.reps);
      if (load === null || reps === null || (reps !== undefined && !Number.isInteger(reps))) {
        return setStatus({ kind: "error", message: `Revisá la serie ${i + 1}: usá solo números.` });
      }
      sets.push({ set: i + 1, load, reps });
    }

    setStatus({ kind: "saving" });
    const snapshot = rows;
    try {
      const result = await saveSetsAction({ week, day, name, order, sets });
      if (!result.ok) return setStatus({ kind: "error", message: result.error });
      setLastSaved(snapshot);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "No pudimos guardar. Revisá tu conexión y probá de nuevo." });
    }
  }

  const inputClass =
    "h-11 w-full min-w-0 rounded-lg border border-line bg-background px-3 text-base tabular-nums outline-none focus:border-accent";

  return (
    <div className="mt-3 rounded-xl bg-background/60 p-3">
      <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-x-2 gap-y-2 text-sm">
        <span />
        <span className="text-xs font-semibold text-muted">Carga (kg)</span>
        <span className="text-xs font-semibold text-muted">Reps</span>
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <span className="self-center text-xs font-semibold text-muted">Serie {i + 1}</span>
            <input
              aria-label={`${name} serie ${i + 1} carga`}
              inputMode="decimal"
              enterKeyHint="next"
              className={inputClass}
              value={row.load}
              onChange={(e) => update(i, "load", e.target.value)}
            />
            <input
              aria-label={`${name} serie ${i + 1} reps`}
              inputMode="numeric"
              enterKeyHint="next"
              className={inputClass}
              value={row.reps}
              onChange={(e) => update(i, "reps", e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p role="status" className={`text-sm ${status.kind === "error" ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
          {status.kind === "saved" && !dirty && "Guardado ✓"}
          {status.kind === "error" && status.message}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status.kind === "saving"}
          className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {status.kind === "saving" ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
