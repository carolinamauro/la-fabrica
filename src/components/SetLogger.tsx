"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { saveSetsAction } from "@/app/actions";
import { chime, unlockAudio, vibrate } from "@/lib/feedback";
import type { ExerciseNote, SetResult } from "@/lib/results";
import { durationFromText } from "@/lib/timer";
import { MAX_NOTE_LENGTH, MAX_SETS } from "@/lib/types";
import { prettyLabel } from "./format";
import { useStartRest } from "./TimerProvider";

type Row = { load: string; reps: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

type Props = {
  week: string;
  day: string;
  name: string;
  order?: string;
  /** Prescribed series; the athlete can add more up to MAX_SETS. */
  setCount: number;
  /** DESCANSO as the coach wrote it ("2 MIN"): the rest started when a series is checked. */
  rest?: string;
  saved: SetResult[];
  /** The athlete's own note on this exercise for this day (NOTAS ALUMNO). */
  note: string;
  /** Their latest note on it from another day, as a reminder. */
  previousNote?: ExerciseNote;
};

/** Rest between series when the plan doesn't say. */
const DEFAULT_REST_SECONDS = 90;

const toText = (value: number | undefined) => (value === undefined ? "" : String(value));
const isFilled = (row: Row) => row.load.trim() !== "" || row.reps.trim() !== "";
const sameRow = (a: Row | undefined, b: Row | undefined) => (a?.load ?? "") === (b?.load ?? "") && (a?.reps ?? "") === (b?.reps ?? "");

function parse(value: string): number | undefined | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return undefined;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** The row as a SetResult, or an error message when it isn't valid numbers. */
function toSet(row: Row, index: number): SetResult | string {
  const load = parse(row.load);
  const reps = parse(row.reps);
  if (load === null || reps === null || (reps !== undefined && !Number.isInteger(reps))) {
    return `Revisá la serie ${index + 1}: usá solo números.`;
  }
  return { set: index + 1, load, reps };
}

const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

function CheckIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <motion.path d="M5 12.5 10 17.5 19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} />
    </svg>
  );
}

/** One dot per series, filled as they are logged: progress at a glance. */
function SetDots({ rows, total }: { rows: Row[]; total: number }) {
  const count = Math.max(total, rows.length);
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const filled = rows[i] && isFilled(rows[i]);
        return (
          <motion.span
            key={i}
            initial={false}
            animate={{ scale: filled ? 1 : 0.8 }}
            transition={spring}
            className={`size-2.5 rounded-full ${filled ? "bg-accent shadow-[0_0_8px_var(--accent)]" : "border border-muted/60"}`}
          />
        );
      })}
    </span>
  );
}

function SavedSummary({ rows, total }: { rows: Row[]; total: number }) {
  const filled = rows.map((row, i) => ({ row, set: i + 1 })).filter(({ row }) => isFilled(row));
  if (!filled.length) {
    return (
      <span className="flex items-center gap-3 text-sm text-muted">
        <SetDots rows={rows} total={total} />
        Sin cargar
      </span>
    );
  }
  // Read-only data, so a thin rail per series instead of boxes that look tappable.
  return (
    <ol aria-label="Series cargadas" className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-x-3 gap-y-2">
      {/* Shown as they are on the first render; series added later fade in. */}
      <AnimatePresence initial={false}>
      {filled.map(({ row, set }) => (
        <motion.li
          key={set}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="border-l-2 border-accent/60 pl-2 leading-none"
        >
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
        </motion.li>
      ))}
      </AnimatePresence>
    </ol>
  );
}

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

/**
 * Carga + Reps per series (like MI_PLANIFICACION columns I–T), opened on demand. Each series has
 * its own check that saves it right away and starts the rest; "Guardar" saves everything and the note.
 */
export function SetLogger({ week, day, name, order, setCount, rest, saved, note, previousNote }: Props) {
  const router = useRouter();
  const startRest = useStartRest();
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
  // Series being saved by their own check.
  const [checking, setChecking] = useState<Set<number>>(new Set());

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
  const dirty = noteText.trim() !== lastSavedNote || rows.some((row, i) => !sameRow(row, lastSaved[i]));
  const isDone = (i: number) => isFilled(rows[i]) && sameRow(rows[i], lastSaved[i]);
  const doneCount = rows.filter((_, i) => isDone(i)).length;

  function update(index: number, field: keyof Row, value: string) {
    setRows((current) => {
      // The first series' load and reps fill the others (most series repeat them), but only the
      // ones still empty or holding the copied value, never a value typed or saved on purpose.
      const copied = index === 0 ? current[0][field] : null;
      return current.map((row, i) => {
        if (i === index) return { ...row, [field]: value };
        const kept = isFilled(row) && sameRow(row, lastSaved[i]);
        if (copied !== null && !kept && (row[field] === "" || row[field] === copied)) return { ...row, [field]: value };
        return row;
      });
    });
    if (status.kind === "error") setStatus({ kind: "idle" });
  }

  const list = useRef<HTMLUListElement>(null);

  function focusLoad(index: number) {
    const next = list.current?.querySelectorAll<HTMLInputElement>("input[data-load]")[index];
    if (!next) return false;
    next.focus({ preventScroll: true });
    next.select();
    return true;
  }

  /** Enter goes to the next series' load; on the last series it closes the keyboard. */
  function nextLoad(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!focusLoad(index + 1)) event.currentTarget.blur();
  }

  /** Saves just this series (the others are left as they are in the sheet) and starts the rest. */
  async function check(index: number) {
    unlockAudio();
    const row = rows[index];
    if (!isFilled(row)) return setStatus({ kind: "error", message: `Cargá la carga o las reps de la serie ${index + 1}.` });
    const set = toSet(row, index);
    if (typeof set === "string") return setStatus({ kind: "error", message: set });

    const previous = lastSaved[index];
    // Optimistic: the check lights up now, and goes back if the sheet refuses it.
    setLastSaved((current) => {
      const next = [...current];
      next[index] = row;
      return next;
    });
    setChecking((current) => new Set(current).add(index));
    setStatus({ kind: "idle" });
    vibrate(35);
    chime();
    const isLast = rows.every((r, i) => i === index || isDone(i));
    if (!isLast) startRest(durationFromText(rest) ?? DEFAULT_REST_SECONDS, `${name} · serie ${index + 2}`);
    (document.activeElement as HTMLElement | null)?.blur();

    try {
      const result = await saveSetsAction({ week, day, name, order, sets: [set] });
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (error) {
      setLastSaved((current) => {
        const next = [...current];
        next[index] = previous ?? { load: "", reps: "" };
        return next;
      });
      vibrate([60, 40, 60]);
      setStatus({
        kind: "error",
        message: error instanceof Error && error.message ? error.message : "No pudimos guardar. Revisá tu conexión y probá de nuevo.",
      });
    } finally {
      setChecking((current) => {
        const next = new Set(current);
        next.delete(index);
        return next;
      });
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
      const set = toSet(row, i);
      if (typeof set === "string") return setStatus({ kind: "error", message: set });
      sets.push(set);
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
      vibrate(35);
      // Refresh the block's series counter from the sheet.
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "No pudimos guardar. Revisá tu conexión y probá de nuevo." });
    }
  }

  if (!open) {
    const started = lastSaved.some(isFilled) || lastSavedNote;
    return (
      <div className="mt-3">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center">
            <SavedSummary rows={lastSaved} total={setCount} />
            {status.kind === "saved" && <span className="sr-only">Guardado</span>}
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              unlockAudio();
              setOpen(true);
              // Straight to the first series still to do.
              const next = lastSaved.findIndex((row) => !isFilled(row));
              requestAnimationFrame(() => focusLoad(next < 0 ? 0 : next));
            }}
            className={`h-10 shrink-0 rounded-xl px-4 font-display text-base font-bold tracking-wider uppercase ${
              started ? "border border-accent/60 text-accent" : "bg-accent text-background shadow-[0_6px_20px_-6px_var(--accent)]"
            }`}
          >
            {started ? "Editar" : "Cargar"}
          </motion.button>
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
    "h-12 w-full min-w-0 rounded-xl border border-line bg-background/80 pr-11 pl-3 font-display text-2xl font-bold tabular-nums outline-none transition-colors focus:border-accent focus:bg-background focus:shadow-[0_0_0_3px_var(--accent-soft)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="mt-3 rounded-2xl border border-line bg-card-raised/80 p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <SetDots rows={rows.map((row, i) => (isDone(i) ? row : { load: "", reps: "" }))} total={rows.length} />
        <span className="font-display text-sm font-bold tracking-wider text-muted tabular-nums">
          <motion.span key={doneCount} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block text-accent">
            {doneCount}
          </motion.span>
          /{rows.length} series
        </span>
      </div>

      <ul ref={list} className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => {
            const done = isDone(i);
            const busy = checking.has(i);
            return (
              <motion.li
                key={i}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className={`flex items-center gap-2 rounded-xl p-1 transition-colors ${done ? "bg-accent-soft" : ""}`}
              >
                <motion.span
                  animate={{ scale: done ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.35 }}
                  className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-bold ${
                    done ? "bg-accent text-background" : "bg-background text-accent"
                  }`}
                >
                  {i + 1}
                </motion.span>
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
                <motion.button
                  type="button"
                  aria-label={done ? `Serie ${i + 1} hecha` : `Marcar serie ${i + 1} como hecha`}
                  aria-pressed={done}
                  disabled={busy || done}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => check(i)}
                  className={`relative grid size-12 shrink-0 place-items-center rounded-xl border-2 transition-colors ${
                    done
                      ? "border-accent bg-accent text-background shadow-[0_0_18px_-2px_var(--accent)]"
                      : isFilled(row)
                        ? "border-accent/70 text-accent"
                        : "border-line text-muted/50"
                  }`}
                >
                  {done ? (
                    <CheckIcon className="size-6" />
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  )}
                  {done && (
                    <motion.span
                      aria-hidden
                      initial={{ scale: 0.6, opacity: 0.8 }}
                      animate={{ scale: 1.8, opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0 rounded-xl border-2 border-accent"
                    />
                  )}
                </motion.button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {rows.length < MAX_SETS && (
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { load: "", reps: "" }])}
          className="mt-2 h-10 w-full rounded-xl border border-dashed border-line font-display font-bold tracking-wider text-muted uppercase active:border-accent active:text-accent"
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
          className="mt-1 block w-full resize-none rounded-xl border border-line bg-background/80 px-3 py-2 text-base outline-none placeholder:text-muted/70 focus:border-accent [field-sizing:content]"
        />
      </label>
      {!noteText && previousNote && (
        <div className="mt-2">
          <PreviousNote previous={previousNote} />
        </div>
      )}

      <AnimatePresence>
        {status.kind === "error" && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-2 text-sm text-red-400"
          >
            {status.message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={status.kind === "saving"}
          className="h-12 rounded-xl px-4 font-display font-bold tracking-wider text-muted uppercase"
        >
          {dirty ? "Cancelar" : "Cerrar"}
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={dirty ? save : () => setOpen(false)}
          disabled={status.kind === "saving" || checking.size > 0}
          className="h-12 rounded-xl bg-accent font-display text-lg font-extrabold tracking-wider text-background uppercase shadow-[0_8px_24px_-10px_var(--accent)] disabled:opacity-40"
        >
          {status.kind === "saving" ? "Guardando…" : dirty ? "Guardar" : "Listo"}
        </motion.button>
      </div>
    </motion.div>
  );
}
