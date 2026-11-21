"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveGoalsAction } from "@/app/actions";
import type { Badge } from "@/lib/achievements";
import type { AchievementsData } from "@/lib/achievements-data";
import { MAX_LIFT_GOALS, type Goals } from "@/lib/goals";
import { useCelebrate } from "./Celebration";
import { formatKg, formatMetric, formatShortDate } from "./history-format";
import { ProgressRing } from "./ProgressRing";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

/** A number that counts up from 0 when it first shows. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!value) return;
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <>{value ? shown : 0}</>;
}

function Streak({ data }: { data: AchievementsData }) {
  const { streak, bestStreak, thisWeek, goals } = data;
  const met = thisWeek.days >= goals.weeklyDays;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 via-card to-card p-4">
      <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <motion.span
          className="text-5xl"
          animate={streak ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1 }}
          aria-hidden
        >
          {streak ? "🔥" : "🌱"}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">Racha</p>
          <p className="font-display text-5xl leading-none font-extrabold tabular-nums">
            <CountUp value={streak} />
            <span className="ml-2 text-xl text-silver">{streak === 1 ? "semana" : "semanas"}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {streak ? `Seguidas con ${goals.weeklyDays}+ días` : `Entrená ${goals.weeklyDays} días esta semana para arrancarla`} · mejor: {bestStreak}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-background/50 p-3">
        <ProgressRing done={thisWeek.days} total={goals.weeklyDays} size={52} stroke={5}>
          <span className="font-display text-sm font-extrabold tabular-nums">
            {thisWeek.days}/{goals.weeklyDays}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold uppercase">{met ? "¡Semana cumplida!" : "Esta semana"}</p>
          <ol className="mt-1.5 flex gap-1.5" aria-label="Días entrenados esta semana">
            {WEEKDAYS.map((label, i) => {
              const trained = thisWeek.weekdays.includes(i);
              return (
                <motion.li
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring, delay: 0.05 * i }}
                  aria-label={`${label}${trained ? ": entrenaste" : ""}`}
                  className={`grid size-7 place-items-center rounded-full font-display text-xs font-bold ${
                    trained ? "bg-accent text-background shadow-[0_0_10px_-2px_var(--accent)]" : "border border-line text-muted"
                  }`}
                >
                  {label}
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p className="mt-1 font-display text-4xl leading-none font-extrabold tabular-nums">
        <CountUp value={value} />
      </p>
    </div>
  );
}

function GoalsCard({ data }: { data: AchievementsData }) {
  const router = useRouter();
  const [goals, setGoals] = useState<Goals>(data.goals);
  const [exercise, setExercise] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  const dirty = JSON.stringify(goals) !== JSON.stringify(data.goals);
  const names = new Map(data.strengthExercises.map((e) => [e.key, e.name]));
  const progress = new Map(data.lifts.map((l) => [l.exercise, l]));
  const available = data.strengthExercises.filter((e) => !goals.lifts.some((l) => l.exercise === e.key));
  const categories = [...new Set(available.map((e) => e.category || "Otros"))];

  function add() {
    const kg = Number(target.replace(",", "."));
    if (!exercise || !(kg > 0)) return setStatus({ kind: "error", message: "Elegí un ejercicio y la carga objetivo." });
    setGoals((g) => ({ ...g, lifts: [...g.lifts, { exercise, targetKg: kg }] }));
    setExercise("");
    setTarget("");
    setStatus({ kind: "idle" });
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const result = await saveGoalsAction(goals);
      if (!result.ok) return setStatus({ kind: "error", message: result.error });
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "No pudimos guardar. Revisá tu conexión." });
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-display text-xl font-bold tracking-wide uppercase">Mis objetivos</h2>
      {!data.stored && (
        <p className="mt-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          Los objetivos todavía no se pueden guardar: falta activar el guardado de logros. Avisale a tu coach.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Días por semana</p>
          <p className="text-sm text-muted">Para sumar a tu racha</p>
        </div>
        <div className="flex items-center gap-2">
          {[-1, 1].map((step) => (
            <motion.button
              key={step}
              type="button"
              whileTap={{ scale: 0.85 }}
              aria-label={step < 0 ? "Un día menos" : "Un día más"}
              disabled={goals.weeklyDays + step < 1 || goals.weeklyDays + step > 7}
              onClick={() => setGoals((g) => ({ ...g, weeklyDays: g.weeklyDays + step }))}
              className={`grid size-10 place-items-center rounded-xl border border-line bg-card-raised font-display text-2xl font-bold text-accent disabled:opacity-30 ${step < 0 ? "order-first" : "order-last"}`}
            >
              {step < 0 ? "−" : "+"}
            </motion.button>
          ))}
          <motion.span key={goals.weeklyDays} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-8 text-center font-display text-3xl font-extrabold tabular-nums">
            {goals.weeklyDays}
          </motion.span>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="font-semibold">Cargas objetivo</p>
        <ul className="mt-2 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {goals.lifts.map((lift) => {
              const best = progress.get(lift.exercise)?.bestKg ?? 0;
              const ratio = Math.min(best / lift.targetKg, 1);
              const reached = best >= lift.targetKg;
              return (
                <motion.li
                  key={lift.exercise}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl bg-background/60 p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-display text-lg font-bold uppercase">
                      {reached && "🎯 "}
                      {names.get(lift.exercise) ?? lift.exercise}
                    </span>
                    <span className="shrink-0 font-display font-bold tabular-nums">
                      <span className={reached ? "text-accent" : ""}>{best ? formatKg(best) : "—"}</span>
                      <span className="text-muted"> / {formatKg(lift.targetKg)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar objetivo de ${names.get(lift.exercise) ?? lift.exercise}`}
                      onClick={() => setGoals((g) => ({ ...g, lifts: g.lifts.filter((l) => l.exercise !== lift.exercise) }))}
                      className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted active:bg-card"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className={`h-full rounded-full ${reached ? "bg-accent shadow-[0_0_10px_var(--accent)]" : "bg-gradient-to-r from-accent/60 to-accent"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${ratio * 100}%` }}
                      transition={{ type: "spring", stiffness: 80, damping: 18 }}
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {goals.lifts.length < MAX_LIFT_GOALS && available.length > 0 && (
          <div className="mt-3 grid grid-cols-[1fr_5.5rem_auto] gap-2">
            <select
              aria-label="Ejercicio"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              className="h-11 min-w-0 rounded-xl border border-line bg-background px-2 text-base outline-none focus:border-accent"
            >
              <option value="">Ejercicio…</option>
              {categories.map((category) => (
                <optgroup key={category} label={category}>
                  {available
                    .filter((e) => (e.category || "Otros") === category)
                    .map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <label className="relative">
              <input
                aria-label="Carga objetivo"
                inputMode="decimal"
                placeholder="100"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-background pr-8 pl-3 font-display text-xl font-bold tabular-nums outline-none focus:border-accent"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted">kg</span>
            </label>
            <button type="button" onClick={add} className="h-11 rounded-xl border border-accent/60 px-3 font-display font-bold tracking-wider text-accent uppercase active:bg-accent-soft">
              +
            </button>
          </div>
        )}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {status.message}
        </p>
      )}
      <AnimatePresence>
        {(dirty || status.kind === "saving") && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            whileTap={{ scale: 0.97 }}
            onClick={save}
            disabled={!data.stored || status.kind === "saving"}
            className="mt-4 h-12 w-full rounded-xl bg-accent font-display text-lg font-extrabold tracking-wider text-background uppercase shadow-[0_8px_24px_-10px_var(--accent)] disabled:opacity-40"
          >
            {status.kind === "saving" ? "Guardando…" : "Guardar objetivos"}
          </motion.button>
        )}
      </AnimatePresence>
      {status.kind === "saved" && !dirty && <p className="mt-3 text-center text-sm text-accent">✓ Objetivos guardados</p>}
    </section>
  );
}

function Badges({ badges, fresh }: { badges: Badge[]; fresh: Set<string> }) {
  const [selected, setSelected] = useState<Badge | null>(null);
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-wide uppercase">Insignias</h2>
        <span className="font-display font-bold text-muted tabular-nums">
          <span className="text-accent">{earned}</span>/{badges.length}
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {badges.map((badge, i) => (
          <motion.li key={badge.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.03 * i }}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setSelected(selected?.id === badge.id ? null : badge)}
              aria-pressed={selected?.id === badge.id}
              className={`relative flex h-full w-full flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-colors ${
                badge.earned ? "border-accent/40 bg-gradient-to-b from-accent/15 to-card" : "border-line bg-card"
              } ${selected?.id === badge.id ? "ring-2 ring-accent" : ""}`}
            >
              {fresh.has(badge.id) && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-accent px-1.5 py-0.5 font-display text-[0.6rem] font-extrabold text-background uppercase">Nueva</span>
              )}
              <span className={`text-3xl ${badge.earned ? "drop-shadow-[0_0_10px_rgb(20_210_189/0.5)]" : "opacity-30 grayscale"}`} aria-hidden>
                {badge.icon}
              </span>
              <span className={`font-display text-xs leading-tight font-bold uppercase ${badge.earned ? "" : "text-muted"}`}>{badge.title}</span>
              {!badge.earned && (
                <span className="mt-auto h-1 w-full overflow-hidden rounded-full bg-line" aria-label={`${badge.current} de ${badge.target}`}>
                  <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(badge.current / badge.target) * 100}%` }} />
                </span>
              )}
            </motion.button>
          </motion.li>
        ))}
      </ul>
      <AnimatePresence mode="wait">
        {selected && (
          <motion.p
            key={selected.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-line bg-card px-3 py-2 text-sm"
          >
            <span className="font-semibold">{selected.title}:</span> {selected.description}.{" "}
            <span className="text-muted">{selected.earned ? "¡Ya la tenés!" : `Vas ${selected.current} de ${selected.target}.`}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

function RecentRecords({ data }: { data: AchievementsData }) {
  if (!data.recentRecords.length) {
    return (
      <section className="rounded-3xl border border-dashed border-line p-4 text-center text-muted">
        Cuando superes tu mejor marca en un ejercicio, tus PRs aparecen acá. 🏆
      </section>
    );
  }
  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-wide uppercase">Últimos PRs</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {data.recentRecords.map((record, i) => (
          <motion.li
            key={`${record.exercise}-${record.date}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.05 * i }}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-xl" aria-hidden>
              🏆
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg leading-tight font-bold uppercase">{record.name}</span>
              <span className="text-sm text-muted">
                {formatShortDate(record.date)} · antes {formatMetric(record.metric, record.previous)}
              </span>
            </span>
            <span className="shrink-0 font-display text-xl font-extrabold text-accent tabular-nums">{formatMetric(record.metric, record.value)}</span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export function AchievementsView({ data }: { data: AchievementsData }) {
  const celebrate = useCelebrate();
  const fresh = new Set(data.fresh.map((b) => b.id));
  const cheered = useRef(false);

  // Badges earned since the last visit get their moment once.
  useEffect(() => {
    if (cheered.current || !data.fresh.length) return;
    cheered.current = true;
    const [first, ...rest] = data.fresh;
    celebrate({
      icon: first.icon,
      eyebrow: data.fresh.length > 1 ? `¡${data.fresh.length} insignias nuevas!` : "¡Insignia nueva!",
      title: first.title,
      detail: rest.length ? `${first.description}. Y también: ${rest.map((b) => b.title).join(", ")}.` : `${first.description}.`,
    });
  }, [celebrate, data.fresh]);

  return (
    <div className="flex flex-col gap-4">
      <Streak data={data} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Entrenamientos" value={data.sessions} icon="💪" />
        <Stat label="PRs" value={data.records} icon="🏆" />
      </div>
      <GoalsCard data={data} />
      <Badges badges={data.badges} fresh={fresh} />
      <RecentRecords data={data} />
    </div>
  );
}
