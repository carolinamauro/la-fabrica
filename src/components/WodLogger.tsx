"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCrossfitWodAction } from "@/app/actions";
import { formatScore, validScore, type WodScore, type WodScoreType } from "@/lib/crossfit-log";
import { chime, unlockAudio, vibrate } from "@/lib/feedback";
import { MAX_NOTE_LENGTH } from "@/lib/types";

export type SavedWod = { score: WodScore; rx: boolean; note?: string };

type Props = {
  day: string;
  entry: string;
  /** The WOD's name ("3 RONDAS · AMRAP 6 MIN"), to guess how it's scored. */
  title: string;
  saved?: SavedWod;
};

const TYPES: { type: WodScoreType; label: string }[] = [
  { type: "time", label: "Tiempo" },
  { type: "rounds", label: "Rondas + reps" },
  { type: "reps", label: "Reps" },
];

/** AMRAPs count rounds, EMOMs and "max" work count reps; anything else is for time. */
function guessType(title: string): WodScoreType {
  if (/AMRAP/i.test(title)) return "rounds";
  if (/EMOM|E\d+MO|MAX|TABATA/i.test(title)) return "reps";
  return "time";
}

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);
const toNumber = (value: string) => (value.trim() ? Number(value) : undefined);

const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

/** The result of a WOD (time, rounds + reps or reps; Rx or scaled), saved to the athlete's CrossFit log. */
export function WodLogger({ day, entry, title, saved: initial }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<WodScoreType>(initial?.score.type ?? guessType(title));
  const seconds = initial?.score.seconds ?? 0;
  const [form, setForm] = useState({
    minutes: initial?.score.type === "time" ? String(Math.floor(seconds / 60)) : "",
    seconds: initial?.score.type === "time" ? String(Math.round(seconds % 60)).padStart(2, "0") : "",
    rounds: initial?.score.rounds !== undefined ? String(initial.score.rounds) : "",
    reps: initial?.score.reps !== undefined ? String(initial.score.reps) : "",
  });
  const [rx, setRx] = useState(initial?.rx ?? true);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [field]: digits(event.target.value) }));
    setError(null);
  };

  function score(): WodScore {
    if (type === "time") return { type, seconds: (toNumber(form.minutes) ?? 0) * 60 + (toNumber(form.seconds) ?? 0) };
    if (type === "rounds") return { type, rounds: toNumber(form.rounds) ?? 0, reps: toNumber(form.reps) ?? 0 };
    return { type, reps: toNumber(form.reps) };
  }

  async function submit(remove = false) {
    unlockAudio();
    const value = remove ? null : score();
    const problem = value && validScore(value);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const result = await saveCrossfitWodAction({ day, entry, score: value, rx, note });
      if (!result.ok) return setError(result.error);
      setSaved(value ? { score: value, rx, note: note.trim() || undefined } : undefined);
      setOpen(false);
      vibrate(35);
      if (value) chime();
      router.refresh();
    } catch {
      setError("No pudimos guardar. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-3">
        {saved ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2 border-l-2 border-accent/60 pl-2">
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted uppercase">Resultado</span>
            <span className="font-display text-xl font-bold text-foreground tabular-nums">{formatScore(saved.score)}</span>
            <span className={`rounded px-1.5 text-xs font-bold ${saved.rx ? "bg-accent text-background" : "border border-silver/40 text-silver"}`}>
              {saved.rx ? "RX" : "SCALED"}
            </span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            unlockAudio();
            setOpen(true);
          }}
          className={`h-9 shrink-0 rounded-xl px-3 font-display text-sm font-bold tracking-wider uppercase ${
            saved ? "border border-accent/60 text-accent" : "bg-accent-soft text-accent"
          }`}
        >
          {saved ? "Editar" : "Cargar resultado"}
        </motion.button>
        {saved?.note && <span className="sr-only">Nota: {saved.note}</span>}
      </div>
    );
  }

  const input =
    "h-12 w-full min-w-0 rounded-xl border border-line bg-background/80 px-3 text-center font-display text-2xl font-bold tabular-nums outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="mt-2 mb-1 rounded-2xl border border-line bg-card-raised/80 p-3 font-sans text-base font-normal tracking-normal text-foreground"
    >
      <div role="radiogroup" aria-label="Cómo se mide" className="grid grid-cols-3 gap-1 rounded-xl bg-background/60 p-1">
        {TYPES.map((option) => (
          <button
            key={option.type}
            type="button"
            role="radio"
            aria-checked={type === option.type}
            onClick={() => {
              setType(option.type);
              setError(null);
            }}
            className={`h-9 rounded-lg font-display text-sm font-bold tracking-wide uppercase transition-colors ${
              type === option.type ? "bg-accent text-background" : "text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {type === "time" ? (
          <>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">Min</span>
              <input aria-label="Minutos" inputMode="numeric" className={input} value={form.minutes} onChange={set("minutes")} />
            </label>
            <span className="mt-5 font-display text-3xl font-bold text-muted">:</span>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">Seg</span>
              <input aria-label="Segundos" inputMode="numeric" className={input} value={form.seconds} onChange={set("seconds")} />
            </label>
          </>
        ) : type === "rounds" ? (
          <>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">Rondas</span>
              <input aria-label="Rondas" inputMode="numeric" className={input} value={form.rounds} onChange={set("rounds")} />
            </label>
            <span className="mt-5 font-display text-3xl font-bold text-muted">+</span>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">Reps</span>
              <input aria-label="Reps extra" inputMode="numeric" className={input} value={form.reps} onChange={set("reps")} />
            </label>
          </>
        ) : (
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">Reps totales</span>
            <input aria-label="Reps totales" inputMode="numeric" className={input} value={form.reps} onChange={set("reps")} />
          </label>
        )}
      </div>

      <div role="radiogroup" aria-label="Nivel" className="mt-3 grid grid-cols-2 gap-2">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={rx === value}
            onClick={() => setRx(value)}
            className={`h-10 rounded-xl border font-display font-bold tracking-wider uppercase ${
              rx === value ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
            }`}
          >
            {value ? "Rx" : "Scaled"}
          </button>
        ))}
      </div>

      <textarea
        aria-label="Nota del resultado"
        rows={1}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Nota: cargas, escalas, cómo te sentiste…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 block w-full resize-none rounded-xl border border-line bg-background/80 px-3 py-2 text-base outline-none placeholder:text-muted/70 focus:border-accent [field-sizing:content]"
      />

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }} className="mt-2 text-sm text-red-400">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-3 flex gap-2">
        {saved && (
          <button type="button" disabled={busy} onClick={() => submit(true)} className="h-12 rounded-xl px-3 font-display font-bold tracking-wider text-red-400 uppercase">
            Borrar
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-12 rounded-xl px-3 font-display font-bold tracking-wider text-muted uppercase">
          Cancelar
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={busy}
          onClick={() => submit()}
          className="h-12 flex-1 rounded-xl bg-accent font-display text-lg font-extrabold tracking-wider text-background uppercase disabled:opacity-40"
        >
          {busy ? "Guardando…" : "Guardar"}
        </motion.button>
      </div>
    </motion.div>
  );
}
