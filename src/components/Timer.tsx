"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULTS,
  formatClock,
  MAX_GROUPS,
  previousWorkIndex,
  segmentStart,
  segments,
  stateAt,
  type Phase,
  type SeriesGroup,
  type TimerConfig,
  type TimerMode,
} from "@/lib/timer";
import { DayTitle } from "./DayTitle";
import { ChevronIcon } from "./icons";

const MODES: { mode: TimerMode; label: string; hint: string }[] = [
  { mode: "amrap", label: "AMRAP", hint: "Máximas rondas en el tiempo" },
  { mode: "emom", label: "EMOM", hint: "Cada minuto (o cada X) arrancás de nuevo" },
  { mode: "fortime", label: "For Time", hint: "Lo más rápido posible, con time cap opcional" },
  { mode: "tabata", label: "Tabata", hint: "Trabajo y descanso por rondas" },
  { mode: "series", label: "Series", hint: "N series de bloques de trabajo, con descanso entre bloques y entre series" },
];

const PHASE_LABEL: Record<Phase, string> = {
  prepare: "Preparate",
  work: "Trabajo",
  rest: "Descanso",
  setRest: "Descanso",
  groupRest: "Descanso",
};

// --- Sound (Web Audio beeps; iOS only plays them after the context is resumed on a tap) ---

let audio: AudioContext | null = null;

function unlockAudio() {
  audio ??= new AudioContext();
  void audio.resume();
}

function beep(frequency: number, seconds: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.25, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
}

/** Keeps the phone screen on while the clock runs (where the browser supports it). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    const request = () => navigator.wakeLock.request("screen").then((l) => (lock = l), () => undefined);
    const onVisible = () => document.visibilityState === "visible" && request();
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** Panel over the dimmed page (which stays put behind it); tapping the page calls `onDismiss`. */
function Sheet({ label, onDismiss, className, children }: { label: string; onDismiss: () => void; className: string; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 pt-[calc(env(safe-area-inset-top)+1.5rem)]" onClick={onDismiss}>
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-line pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

// --- Setup ---

const STEP_BUTTON =
  "grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-card-raised font-display text-3xl font-bold text-accent active:bg-accent active:text-background disabled:opacity-30";

/** Whole number the athlete can type (numeric keyboard); valid values apply as they type. */
function NumberInput({
  label,
  value,
  min,
  max,
  pad = 0,
  className = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  pad?: number;
  className?: string;
  onChange: (value: number) => void;
}) {
  // While focused, show what is being typed (even "" or out of range); on blur, the real value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      enterKeyHint="done"
      className={`h-12 min-w-0 rounded-lg border border-line bg-background text-center font-display text-3xl font-extrabold tabular-nums outline-none focus:border-accent ${className}`}
      value={draft ?? String(value).padStart(pad, "0")}
      onFocus={(e) => {
        setDraft(String(value));
        e.target.select();
      }}
      onChange={(e) => {
        const text = e.target.value.replace(/\D/g, "").slice(0, 3);
        setDraft(text);
        if (text) onChange(Math.min(max, Math.max(min, Number(text))));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="mb-2 flex justify-between font-display text-base font-bold tracking-wider text-muted uppercase">
        {label}
        {hint && <span className="font-sans text-xs font-normal tracking-normal normal-case">{hint}</span>}
      </p>
      <div className="flex items-center justify-between gap-2">{children}</div>
    </div>
  );
}

function CountField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <button type="button" aria-label={`Menos ${label}`} className={STEP_BUTTON} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <NumberInput label={label} value={value} min={min} max={max} className="w-24" onChange={onChange} />
      <button type="button" aria-label={`Más ${label}`} className={STEP_BUTTON} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </Field>
  );
}

/** Minutes and seconds, typed or stepped by `step` seconds. */
function DurationField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const clamp = (seconds: number) => Math.min(max, Math.max(min, seconds));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return (
    <Field label={label} hint="min : seg">
      <button type="button" aria-label={`Menos ${label}`} className={STEP_BUTTON} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <div className="flex items-center gap-1">
        <NumberInput label={`${label} minutos`} value={minutes} min={0} max={Math.floor(max / 60)} className="w-16" onChange={(m) => onChange(clamp(m * 60 + seconds))} />
        <span className="font-display text-3xl font-extrabold">:</span>
        <NumberInput label={`${label} segundos`} value={seconds} min={0} max={59} pad={2} className="w-16" onChange={(s) => onChange(clamp(minutes * 60 + s))} />
      </div>
      <button type="button" aria-label={`Más ${label}`} className={STEP_BUTTON} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </Field>
  );
}

type SeriesConfig = Extract<TimerConfig, { mode: "series" }>;

const workoutSeconds = (config: TimerConfig) => segments(config).slice(1).reduce((sum, s) => sum + s.seconds, 0);

/**
 * Series as numbers ("10 series of 5 blocks"), not one by one. Another group is only needed when
 * the shape changes (different blocks, times or rests).
 */
function SeriesFields({ config, onChange }: { config: SeriesConfig; onChange: (config: TimerConfig) => void }) {
  const { groups } = config;
  const update = (index: number, patch: Partial<SeriesGroup>) =>
    onChange({ ...config, groups: groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) });

  return (
    <>
      {groups.map((g, i) => (
        <section key={i} className={`flex flex-col gap-2 ${groups.length > 1 ? "border-l-4 border-accent pl-3" : ""}`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold uppercase">
              {groups.length > 1 ? `Grupo ${i + 1}` : "Estructura"}
              <span className="ml-2 font-sans text-sm font-normal text-muted normal-case">
                {g.sets} × {g.blocks} bloques · {formatClock(workoutSeconds({ mode: "series", groups: [g] }))}
              </span>
            </h2>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => onChange({ ...config, groups: groups.filter((_, j) => j !== i) })}
                className="h-9 shrink-0 px-2 font-display text-sm font-bold tracking-wider text-muted uppercase"
              >
                Quitar
              </button>
            )}
          </div>
          <CountField label="Series" value={g.sets} min={1} max={99} onChange={(sets) => update(i, { sets })} />
          {g.sets > 1 && (
            <DurationField label="Descanso entre series" value={g.setRest} step={15} min={0} max={1800} onChange={(setRest) => update(i, { setRest })} />
          )}
          <CountField label="Bloques por serie" value={g.blocks} min={1} max={99} onChange={(blocks) => update(i, { blocks })} />
          <DurationField label="Trabajo por bloque" value={g.work} step={5} min={5} max={3600} onChange={(work) => update(i, { work })} />
          {g.blocks > 1 && (
            <DurationField label="Descanso entre bloques" value={g.rest} step={5} min={0} max={1800} onChange={(rest) => update(i, { rest })} />
          )}
          {i < groups.length - 1 && (
            <DurationField label={`Descanso antes del grupo ${i + 2}`} value={g.restAfter} step={15} min={0} max={1800} onChange={(restAfter) => update(i, { restAfter })} />
          )}
        </section>
      ))}
      {groups.length < MAX_GROUPS && (
        <button
          type="button"
          // A new group starts as a copy of the last one; the athlete changes what differs.
          onClick={() => onChange({ ...config, groups: [...groups, { ...groups[groups.length - 1] }] })}
          className="flex h-14 flex-col items-center justify-center rounded-xl border border-dashed border-line font-display text-lg leading-tight font-bold tracking-wider text-muted uppercase"
        >
          + Agregar otro grupo
          <span className="font-sans text-xs font-normal tracking-normal normal-case">si cambia la estructura de las series</span>
        </button>
      )}
    </>
  );
}

function Fields({ config, onChange }: { config: TimerConfig; onChange: (config: TimerConfig) => void }) {
  switch (config.mode) {
    case "amrap":
      return <DurationField label="Tiempo" value={config.time} step={30} min={10} max={3 * 3600} onChange={(time) => onChange({ ...config, time })} />;
    case "fortime":
      return (
        <>
          <DurationField label="Time cap" value={config.cap} step={30} min={0} max={3 * 3600} onChange={(cap) => onChange({ ...config, cap })} />
          <p className="-mt-2 text-sm text-muted">Dejalo en 0:00 para correr sin límite.</p>
        </>
      );
    case "emom":
      return (
        <>
          <DurationField label="Cada" value={config.every} step={15} min={10} max={1800} onChange={(every) => onChange({ ...config, every })} />
          <CountField label="Rondas" value={config.rounds} min={1} max={99} onChange={(rounds) => onChange({ ...config, rounds })} />
        </>
      );
    case "tabata":
      return (
        <>
          <DurationField label="Trabajo" value={config.work} step={5} min={5} max={3600} onChange={(work) => onChange({ ...config, work })} />
          <DurationField label="Descanso" value={config.rest} step={5} min={0} max={1800} onChange={(rest) => onChange({ ...config, rest })} />
          <CountField label="Rondas" value={config.rounds} min={1} max={99} onChange={(rounds) => onChange({ ...config, rounds })} />
        </>
      );
    case "series":
      return <SeriesFields config={config} onChange={onChange} />;
  }
}

// --- Running clock ---

/** Running time is `banked` seconds plus the time since `startedAt` (null while paused). */
type Run = { startedAt: number | null; banked: number; finished: boolean };

type ClockProps = {
  config: TimerConfig;
  /** Docked at the bottom of the page instead of in the sheet; it keeps running either way. */
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  /** The workout is over and closed: nothing stays docked. */
  onEnd: () => void;
};

function RunningClock({ config, minimized, onMinimize, onExpand, onEnd }: ClockProps) {
  const list = useMemo(() => segments(config), [config]);
  const [run, setRun] = useState<Run>(() => ({ startedAt: performance.now(), banked: 0, finished: false }));
  const [now, setNow] = useState(() => performance.now());
  const lastCue = useRef("");

  const seconds = run.banked + (run.startedAt === null ? 0 : (now - run.startedAt) / 1000);
  const timed = stateAt(list, seconds);
  // "Terminé" in a For Time ends it at the athlete's time.
  const state = run.finished ? { ...timed, done: true } : timed;
  const running = run.startedAt !== null && !state.done;
  const countUp = config.mode === "fortime" && state.segment.phase === "work";

  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  // Beeps: 3-2-1 before each change, a long one when work starts, three at the end.
  useEffect(() => {
    const left = Math.ceil(state.remaining);
    const cue = state.done ? "done" : left <= 3 ? `${state.index}:${left}` : `${state.index}`;
    if (cue === lastCue.current) return;
    const previous = lastCue.current;
    lastCue.current = cue;
    if (!previous) return;
    if (state.done) {
      [0, 350, 700].forEach((ms) => setTimeout(() => beep(880, 0.3), ms));
    } else if (left <= 3) {
      beep(660, 0.12);
    } else {
      beep(state.segment.phase === "work" ? 990 : 520, 0.5);
    }
  }, [state.done, state.index, state.remaining, state.segment.phase]);

  function pause(finished = false) {
    setRun({ startedAt: null, banked: seconds, finished });
  }
  function resume() {
    unlockAudio();
    const at = performance.now();
    setNow(at);
    setRun({ startedAt: at, banked: run.banked, finished: false });
  }
  /** Moves to the start of segment `index` (past the last one = finished), keeping running or paused. */
  function jumpTo(index: number) {
    const target = segmentStart(list, index);
    // Skipping an open-ended For Time ends it at the current time.
    if (!Number.isFinite(target)) return pause(true);
    const at = performance.now();
    setNow(at);
    setRun({ startedAt: run.startedAt === null ? null : at, banked: target, finished: false });
  }

  const phase = state.done ? "done" : state.segment.phase;
  const background = {
    prepare: "bg-card",
    work: "bg-accent text-background",
    rest: "bg-silver text-background",
    setRest: "bg-silver text-background",
    groupRest: "bg-silver text-background",
    done: "bg-card",
  }[phase];
  const { round, rounds, serie, series, group, groups } = state.segment;
  // Once done, show the workout time (without the prepare countdown).
  const display = state.done
    ? formatClock(Math.min(seconds, list.reduce((sum, s) => sum + s.seconds, 0)) - list[0].seconds)
    : countUp
      ? formatClock(state.elapsed)
      : formatClock(Math.ceil(state.remaining));
  const progress = Number.isFinite(state.segment.seconds) ? state.elapsed / state.segment.seconds : 0;
  const control = "h-16 flex-1 rounded-xl font-display text-xl font-extrabold tracking-wider uppercase";

  if (minimized) {
    const small = "grid size-12 shrink-0 place-items-center rounded-xl bg-black/15 font-display text-lg font-extrabold uppercase";
    return (
      // Above the page's own bottom bar, if it has one (see --dock in globals.css).
      <div data-timer-dock className="fixed inset-x-0 bottom-[calc(var(--dock)+env(safe-area-inset-bottom))] z-40 px-4 pb-3">
        <div className={`mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-line p-2 pl-4 shadow-lg shadow-black/50 transition-colors ${background}`}>
          <button type="button" onClick={onExpand} aria-label="Abrir timer" className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="font-display text-4xl leading-none font-extrabold tabular-nums">{display}</span>
            <span className="min-w-0 font-display leading-tight font-bold tracking-wider uppercase">
              <span className="block truncate">{state.done ? "¡Terminado!" : run.startedAt === null ? "En pausa" : PHASE_LABEL[state.segment.phase]}</span>
              <span className="block truncate text-sm opacity-70">
                {MODES.find((m) => m.mode === config.mode)?.label}
                {!state.done && rounds > 1 && round > 0 && ` · ${round}/${rounds}`}
              </span>
            </span>
            <ChevronIcon className="ml-auto size-6 shrink-0 rotate-180 opacity-60" />
          </button>
          {state.done ? (
            <button type="button" onClick={onEnd} aria-label="Cerrar timer" className={small}>
              ✕
            </button>
          ) : running ? (
            <button type="button" onClick={() => pause()} aria-label="Pausa" className={small}>
              ❚❚
            </button>
          ) : (
            <button type="button" onClick={resume} aria-label="Seguir" className={small}>
              ▶
            </button>
          )}
        </div>
      </div>
    );
  }

  // While the workout is on, leaving the sheet docks it at the bottom; once over, it goes away.
  return (
    <Sheet label="Timer en curso" onDismiss={state.done ? onEnd : onMinimize} className={`px-5 pt-4 transition-colors ${background}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold tracking-widest uppercase opacity-70">{MODES.find((m) => m.mode === config.mode)?.label}</span>
        {!state.done && (
          <button
            type="button"
            onClick={onMinimize}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/15 pr-4 pl-3 font-display text-base font-bold tracking-wider uppercase"
          >
            <ChevronIcon />
            Minimizar
          </button>
        )}
      </div>
      <div className="mt-3 flex justify-end font-display font-bold tracking-widest uppercase">
        {!state.done && (
          <span className="flex flex-col items-end tabular-nums">
            {groups && groups > 1 && (
              <span className="text-lg opacity-80">
                Grupo {group}
                <span className="opacity-60">/{groups}</span>
              </span>
            )}
            {series && series > 1 && (
              <span className="text-2xl">
                Serie {serie}
                <span className="opacity-60">/{series}</span>
              </span>
            )}
            {rounds > 1 && round > 0 && (
              <span className="text-3xl">
                {config.mode === "series" && <span className="text-xl">Bloque </span>}
                {round}
                <span className="opacity-60">/{rounds}</span>
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="font-display text-4xl font-extrabold tracking-[0.2em] uppercase">
          {state.done ? "¡Terminado!" : PHASE_LABEL[state.segment.phase]}
        </p>
        <p className="font-display text-[clamp(6rem,30vw,14rem)] leading-none font-extrabold tabular-nums" aria-live="off">
          {display}
        </p>
        {!state.done && (state.segment.phase === "setRest" || state.segment.phase === "groupRest") && (
          <p className="font-display text-2xl font-bold tracking-widest uppercase opacity-70">
            {state.segment.phase === "setRest" ? `Sigue serie ${(serie ?? 0) + 1}` : `Sigue grupo ${(group ?? 0) + 1}`}
          </p>
        )}
        {!state.done && (
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
        {run.startedAt === null && !state.done && (
          <>
            <p className="mt-6 font-display text-2xl font-bold tracking-widest uppercase opacity-70">En pausa</p>
            <button
              type="button"
              onClick={() => pause(true)}
              className="mt-4 h-12 rounded-xl border-2 border-current px-6 font-display text-lg font-bold tracking-wider uppercase"
            >
              Finalizar
            </button>
          </>
        )}
      </div>

      {!state.done && (
        <div className="mb-3 flex gap-3">
          <button
            type="button"
            onClick={() => jumpTo(previousWorkIndex(list, state.index))}
            className="h-12 flex-1 rounded-xl bg-black/15 font-display text-lg font-bold tracking-wider uppercase"
          >
            ⏮ Anterior
          </button>
          <button
            type="button"
            onClick={() => jumpTo(state.index + 1)}
            className="h-12 flex-1 rounded-xl bg-black/15 font-display text-lg font-bold tracking-wider uppercase"
          >
            Siguiente ⏭
          </button>
        </div>
      )}
      <div className="flex gap-3">
        {state.done ? (
          <button type="button" onClick={onEnd} className={`${control} border-2 border-current`}>
            Cerrar
          </button>
        ) : config.mode === "fortime" && state.segment.phase === "work" && running ? (
          <button type="button" onClick={() => pause(true)} className={`${control} bg-background text-foreground`}>
            Terminé
          </button>
        ) : running ? (
          <button type="button" onClick={() => pause()} className={`${control} bg-background text-foreground`}>
            Pausa
          </button>
        ) : (
          <button type="button" onClick={resume} className={`${control} bg-background text-accent`}>
            Seguir
          </button>
        )}
      </div>
    </Sheet>
  );
}

// --- Sheet ---

type TimerProps = Omit<ClockProps, "config" | "onEnd"> & {
  initial: TimerConfig;
  /** Closes the timer altogether (the setup sheet, or a finished workout). */
  onClose: () => void;
};

/** Setup sheet over the page; once started, the clock (in the sheet or docked). */
export function Timer({ initial, onClose, ...clock }: TimerProps) {
  const [config, setConfig] = useState<TimerConfig>(initial);
  const [runId, setRunId] = useState<number | null>(null);
  const total = workoutSeconds(config);

  function start() {
    unlockAudio();
    setRunId(Date.now());
  }

  if (runId !== null) return <RunningClock key={runId} config={config} onEnd={onClose} {...clock} />;

  return (
    <Sheet label="Timer" onDismiss={onClose} className="gap-4 bg-background px-4 pt-5">
      <div className="flex items-start justify-between gap-3">
        <DayTitle eyebrow="Reloj" title="Timer" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar timer"
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-xl text-muted"
        >
          ✕
        </button>
      </div>
      <SetupFields initial={initial} config={config} total={total} onChange={setConfig} onStart={start} />
    </Sheet>
  );
}

function SetupFields({
  initial,
  config,
  total,
  onChange: setConfig,
  onStart: start,
}: {
  initial: TimerConfig;
  config: TimerConfig;
  total: number;
  onChange: (config: TimerConfig) => void;
  onStart: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={config.mode === mode}
            onClick={() => setConfig(mode === initial.mode ? initial : DEFAULTS[mode])}
            className={`h-14 rounded-xl last:col-span-2 font-display text-xl font-extrabold tracking-wider uppercase ${
              config.mode === mode ? "bg-accent text-background" : "border border-line bg-card text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-muted">{MODES.find((m) => m.mode === config.mode)?.hint}</p>
      <Fields config={config} onChange={setConfig} />
      <p className="text-center font-display text-lg font-bold tracking-wider text-muted uppercase">
        Total {Number.isFinite(total) ? formatClock(total) : "sin límite"}
      </p>
      <button
        type="button"
        onClick={start}
        className="h-16 rounded-xl bg-accent font-display text-2xl font-extrabold tracking-widest text-background uppercase active:translate-y-px"
      >
        Empezar
      </button>
    </>
  );
}
