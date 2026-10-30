"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { saveSetsAction } from "@/app/actions";
import type { ExerciseNote, SetResult } from "@/lib/results";
import { MAX_NOTE_LENGTH, MAX_SETS } from "@/lib/types";
import { prettyLabel } from "./format";

type Row = { load: string; reps: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

type Props = {
  week: string;
  day: string;
  name: string;
  order?: string;
  /** Prescribed series; the athlete can add more up to MAX_SETS. */
  setCount: number;
  saved: SetResult[];
  /** The athlete's own note on this exercise for this day (NOTAS ALUMNO). */
  note: string;
  /** Their latest note on it from another day, as a reminder. */
  previousNote?: ExerciseNote;
};

const toText = (value: number | undefined) => (value === undefined ? "" : String(value));
const isFilled = (row: Row) => row.load.trim() !== "" || row.reps.trim() !== "";

function parse(value: string): number | undefined | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function SavedSummary({ rows }: { rows: Row[] }) {
  const filled = rows.map((row, i) => ({ row, set: i + 1 })).filter(({ row }) => isFilled(row));
  if (!filled.length) return <span className="text-sm text-muted">Sin cargar</span>;
  // Read-only data, so a thin rail per series instead of boxes that look tappable.
  return (
    <ol aria-label="Series cargadas" className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-x-3 gap-y-2">
      {filled.map(({ row, set }) => (
        <li key={set} className="border-l-2 border-accent/50 pl-2 leading-none">
          <span className="block text-[0.65rem] font-semibold tracking-widest text-muted uppercase">Serie {set}</span>
          <span className="mt-1 block font-display text-lg font-bold whitespace-nowrap tabular-nums">
            {row.load && (
              <>
                {row.load}
                <span className="ml-0.5 text-xs font-semibold text-muted">kg</span>
              </>
            )}
            {row.reps && (
              <span className={row.load ? "ml-1 text-silver" : ""}>
                {row.load && <span className="text-sm text-muted">×</span>}
                {row.reps}
                {!row.load && <span className="ml-0.5 text-xs font-semibold text-muted">reps</span>}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Carga + Reps per series (like MI_PLANIFICACION columns I–T), opened on demand and saved to the sheet. */
/** "Semana 1 · Día 2: subir despacio", what the athlete wrote last time. */
function PreviousNote({ previous }: { previous: ExerciseNote }) {
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-silver">
        La última vez ({prettyLabel(previous.week)} · {prettyLabel(previous.day)}):
      </span>{" "}
      <span className="whitespace-pre-line">{previous.note}</span>
    </p>
  );
}

export function SetLogger({ week, day, name, order, setCount, saved, note, previousNote }: Props) {
  const router = useRouter();
  const lastSet = Math.max(0, ...saved.map((s) => s.set));
  const initial = Array.from({ length: Math.min(Math.max(setCount, lastSet), MAX_SETS) }, (_, i) => {
    const entry = saved.find((s) => s.set === i + 1);
    return { load: toText(entry?.load), reps: toText(entry?.reps) };
  });

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(initial);
  const [lastSaved, setLastSaved] = useState<Row[]>(initial);
  const [noteText, setNoteText] = useState(note);
  const [lastSavedNote, setLastSavedNote] = useState(note);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Values changed in the sheet (seen on pull to refresh) replace these, unless the athlete is editing.
  const savedKey = JSON.stringify([initial, note]);
  const [shownKey, setShownKey] = useState(savedKey);
  if (savedKey !== shownKey && !open) {
    setShownKey(savedKey);
    setRows(initial);
    setLastSaved(initial);
    setNoteText(note);
    setLastSavedNote(note);
  }

  // An added but empty series is not a change.
  const dirty =
    noteText.trim() !== lastSavedNote ||
    rows.some((row, i) => row.load !== (lastSaved[i]?.load ?? "") || row.reps !== (lastSaved[i]?.reps ?? ""));

  function update(index: number, field: keyof Row, value: string) {
    setRows((current) => {
      // The first series' load and reps fill the others (most series repeat them), but only the
      // ones still empty or holding the copied value, never a value typed on purpose.
      const copied = index === 0 ? current[0][field] : null;
      return current.map((row, i) => {
        if (i === index) return { ...row, [field]: value };
        if (copied !== null && (row[field] === "" || row[field] === copied)) return { ...row, [field]: value };
        return row;
      });
    });
    if (status.kind === "error") setStatus({ kind: "idle" });
  }

  const list = useRef<HTMLUListElement>(null);

  /** Enter goes to the next series' load; on the last series it closes the keyboard. */
  function nextLoad(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = list.current?.querySelectorAll<HTMLInputElement>("input[data-load]")[index + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      event.currentTarget.blur();
    }
  }

  function cancel() {
    setRows(lastSaved);
    setNoteText(lastSavedNote);
    setStatus({ kind: "idle" });
    setOpen(false);
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
    const savedNote = noteText.trim();
    try {
      const result = await saveSetsAction({ week, day, name, order, sets, note: savedNote });
      if (!result.ok) return setStatus({ kind: "error", message: result.error });
      setLastSaved(snapshot);
      setNoteText(savedNote);
      setLastSavedNote(savedNote);
      setStatus({ kind: "saved" });
      setOpen(false);
      // Refresh the block's series counter from the sheet.
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "No pudimos guardar. Revisá tu conexión y probá de nuevo." });
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center">
            <SavedSummary rows={lastSaved} />
            {status.kind === "saved" && <span className="sr-only">Guardado</span>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 shrink-0 rounded-lg border border-accent px-4 font-display text-base font-bold tracking-wider text-accent uppercase active:bg-accent active:text-background"
          >
            {lastSaved.some(isFilled) || lastSavedNote ? "Editar" : "Cargar"}
          </button>
        </div>
        {lastSavedNote ? (
          <p className="mt-3 rounded-lg border-l-2 border-silver/50 bg-background/50 px-3 py-2 text-sm">
            <span className="block text-[0.65rem] font-semibold tracking-widest text-muted uppercase">Mi nota</span>
            <span className="whitespace-pre-line">{lastSavedNote}</span>
          </p>
        ) : (
          previousNote && (
            <div className="mt-3">
              <PreviousNote previous={previousNote} />
            </div>
          )
        )}
      </div>
    );
  }

  const input =
    "h-12 w-full min-w-0 rounded-lg border border-line bg-background pr-11 pl-3 font-display text-2xl font-bold tabular-nums outline-none focus:border-accent";

  return (
    <div className="mt-3 rounded-xl border border-line bg-card-raised p-3">
      <ul ref={list} className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background font-display text-lg font-bold text-accent">
              {i + 1}
            </span>
            <label className="relative flex-1">
              <input
                aria-label={`${name} serie ${i + 1} carga`}
                data-load
                inputMode="decimal"
                enterKeyHint={i < rows.length - 1 ? "next" : "done"}
                className={input}
                value={row.load}
                onChange={(e) => update(i, "load", e.target.value)}
                onKeyDown={(e) => nextLoad(e, i)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">kg</span>
            </label>
            <label className="relative flex-1">
              <input
                aria-label={`${name} serie ${i + 1} reps`}
                inputMode="numeric"
                enterKeyHint={i < rows.length - 1 ? "next" : "done"}
                className={input}
                value={row.reps}
                onChange={(e) => update(i, "reps", e.target.value)}
                onKeyDown={(e) => nextLoad(e, i)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">reps</span>
            </label>
          </li>
        ))}
      </ul>

      {rows.length < MAX_SETS && (
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { load: "", reps: "" }])}
          className="mt-2 h-10 w-full rounded-lg border border-dashed border-line font-display font-bold tracking-wider text-muted uppercase"
        >
          + Serie <span className="font-sans text-xs font-normal normal-case">(máx. {MAX_SETS})</span>
        </button>
      )}

      <label className="mt-3 block">
        <span className="flex items-baseline justify-between">
          <span className="font-display text-sm font-bold tracking-widest text-muted uppercase">Mi nota</span>
          {noteText.length > MAX_NOTE_LENGTH - 100 && (
            <span className="text-xs text-muted tabular-nums">
              {noteText.length}/{MAX_NOTE_LENGTH}
            </span>
          )}
        </span>
        <textarea
          aria-label={`${name} mi nota`}
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Lo que quieras recordar: técnica, agarre, cómo te sentiste…"
          value={noteText}
          onChange={(e) => {
            setNoteText(e.target.value);
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
          className="mt-1 block w-full resize-none rounded-lg border border-line bg-background px-3 py-2 text-base outline-none placeholder:text-muted/70 focus:border-accent [field-sizing:content]"
        />
      </label>
      {!noteText && previousNote && (
        <div className="mt-2">
          <PreviousNote previous={previousNote} />
        </div>
      )}

      {status.kind === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {status.message}
        </p>
      )}

      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={status.kind === "saving"}
          className="h-12 rounded-lg px-4 font-display font-bold tracking-wider text-muted uppercase"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status.kind === "saving"}
          className="h-12 rounded-lg bg-accent font-display text-lg font-extrabold tracking-wider text-background uppercase disabled:opacity-40"
        >
          {status.kind === "saving" ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
