"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveRmAction } from "@/app/actions";
import { effortFromTarget, formatEffort, formatKg, loadFor, parseEffort, type Effort } from "@/lib/effort";
import { Sheet } from "./Sheet";

type Props = {
  name: string;
  /** The plan's OBJETIVO ("70 %", "RPE 8"): the default effort. */
  target?: string;
  reps?: string;
  /** Heaviest load the athlete logged for this exercise: the default RM. */
  bestLoad?: number;
  /** Whether a higher RM can be saved to the athlete's sheet (not for CrossFit). */
  canSave: boolean;
};

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const parseKg = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) && value > 0 && value <= 1000 ? value : undefined;
};

/** "45 kg", or "50–52,5 kg" for an effort range. */
function weightText(rm: number, { min, max }: Effort) {
  const [low, high] = [loadFor(rm, min), loadFor(rm, max)];
  return low === high ? formatKg(low) : `${formatKg(low)}–${formatKg(high)}`;
}

/**
 * The plan's effort as a tappable tag with the weight it means ("70 % · ≈ 45 kg"), opening a
 * calculator where the athlete can change their RM (saved when it beats their best) and effort.
 */
export function LoadCalculator({ name, target, reps, bestLoad, canSave }: Props) {
  const router = useRouter();
  const planEffort = effortFromTarget(target, reps);
  const defaults = { rm: bestLoad ? formatKg(bestLoad) : "", effort: planEffort ? formatEffort(planEffort) : "" };
  const [open, setOpen] = useState(false);
  const [rmText, setRmText] = useState(defaults.rm);
  const [effortText, setEffortText] = useState(defaults.effort);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Every time it opens, it starts from this exercise's best load and planned effort.
  function show() {
    setRmText(defaults.rm);
    setEffortText(defaults.effort);
    setStatus({ kind: "idle" });
    setOpen(true);
  }

  const rm = parseKg(rmText);
  const effort = parseEffort(effortText);
  const canSaveRm = canSave && rm !== undefined && rm > (bestLoad ?? 0) && status.kind !== "saved";

  function close() {
    setOpen(false);
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  }

  async function saveRm() {
    if (rm === undefined) return;
    setStatus({ kind: "saving" });
    try {
      const result = await saveRmAction({ name, rm });
      if (!result.ok) return setStatus({ kind: "error", message: result.error });
      setStatus({ kind: "saved" });
      // The new best load becomes the default RM next time.
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "No pudimos guardar tu RM. Revisá tu conexión y probá de nuevo." });
    }
  }

  const field =
    "mt-1 h-14 w-full min-w-0 rounded-lg border border-line bg-background px-3 font-display text-3xl font-bold tabular-nums outline-none focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex items-baseline gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent active:bg-accent active:text-background"
      >
        {target ?? "Calcular peso"}
        {target && bestLoad && planEffort && (
          <span className="font-display font-bold text-foreground">≈ {weightText(bestLoad, planEffort)} kg</span>
        )}
        <span aria-hidden className="text-xs">
          ›
        </span>
      </button>

      {open && (
        <Sheet label={`Calcular peso de ${name}`} onDismiss={close} className="gap-5 bg-background px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-widest text-accent uppercase">Calcular peso</p>
              <h2 className="font-display text-2xl leading-tight font-bold uppercase">{name}</h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="h-10 shrink-0 rounded-lg border border-line px-3 font-display font-bold tracking-wider text-muted uppercase"
            >
              Cerrar
            </button>
          </div>

          <label className="block">
            <span className="font-display text-sm font-bold tracking-widest text-muted uppercase">Mi RM (kg)</span>
            <input
              inputMode="decimal"
              value={rmText}
              placeholder="Ej: 80"
              onChange={(e) => {
                setRmText(e.target.value);
                if (status.kind !== "saving") setStatus({ kind: "idle" });
              }}
              className={field}
            />
            <span className="mt-1 block text-sm text-muted">
              {bestLoad ? `Tu mejor carga registrada: ${formatKg(bestLoad)} kg.` : "Todavía no hay cargas registradas."} Si
              tu RM es otro, cambialo.
            </span>
          </label>

          <label className="block">
            <span className="font-display text-sm font-bold tracking-widest text-muted uppercase">Esfuerzo (% del RM)</span>
            <input
              inputMode="decimal"
              value={effortText}
              placeholder="Ej: 75 o 70-80"
              onChange={(e) => setEffortText(e.target.value)}
              className={field}
            />
            <span className="mt-1 block text-sm text-muted">
              {planEffort
                ? /RPE/i.test(target ?? "") && !/%/.test(target ?? "")
                  ? `Del plan: ${target} con ${reps} reps.`
                  : `Del plan: ${target}.`
                : target
                  ? `El plan dice "${target}": escribí el porcentaje.`
                  : "El plan no tiene esfuerzo: escribí el porcentaje."}
            </span>
          </label>

          <div className="rounded-2xl border border-line border-l-4 border-l-accent bg-card p-4">
            <p className="font-display text-sm font-bold tracking-widest text-muted uppercase">Peso sugerido</p>
            <p className="font-display text-5xl leading-tight font-extrabold tabular-nums">
              {rm !== undefined && effort ? (
                <>
                  {weightText(rm, effort)}
                  <span className="ml-1 text-2xl text-muted">kg</span>
                </>
              ) : (
                <span className="text-2xl text-muted">Completá tu RM y el esfuerzo</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted">Redondeado a 2,5 kg.</p>
          </div>

          {status.kind === "error" && (
            <p role="alert" className="text-sm text-red-400">
              {status.message}
            </p>
          )}
          {status.kind === "saved" && (
            <p role="status" className="text-sm text-accent">
              Guardamos tu RM de {rmText} kg en tu historial.
            </p>
          )}
          {canSaveRm && (
            <button
              type="button"
              onClick={saveRm}
              disabled={status.kind === "saving"}
              className="h-14 rounded-xl bg-accent font-display text-xl font-extrabold tracking-wider text-background uppercase disabled:opacity-40"
            >
              {status.kind === "saving" ? "Guardando…" : `Guardar ${rmText} kg como mi RM`}
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
