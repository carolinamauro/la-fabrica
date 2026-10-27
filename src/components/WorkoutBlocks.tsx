import type { ReactNode } from "react";
import { timerFromText } from "@/lib/timer";
import type { Block, Exercise } from "@/lib/types";
import { TimerIcon } from "./icons";
import { TimerButton } from "./TimerProvider";

/** Extra content under an exercise (e.g. the Carga/Reps logger of personalized plans). */
type RenderExtra = (exercise: Exercise) => ReactNode;
/** Extra content on the right of a collapsed block header (e.g. series progress). */
type RenderAside = (block: Block) => ReactNode;

// Section headers in free text: "A. 3 RONDAS:", "C. EMOM X 15 MIN".
const SECTION = /^[A-Z]\d?\s*[.:]\s|:$/;

const URL_PATTERN = /(https?:\/\/\S+)/;

/** Text with its links made tappable (coaches paste exercise videos in notes). */
function LinkedText({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
        {/youtu\.?be/.test(part) ? "Ver video" : "Abrir link"}
      </a>
    ) : (
      part
    ),
  );
}

/** "▶ Timer" next to a programming line that names one ("EMOM X 15 MIN"), opening it already set up. */
function TimerLink({ text }: { text: string }) {
  const config = timerFromText(text);
  if (!config) return null;
  return (
    <TimerButton
      config={config}
      className="ml-2 inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 align-middle font-display text-sm font-extrabold tracking-wider text-background uppercase"
    >
      ▶ Timer
    </TimerButton>
  );
}

/** Personalized blocks are named by ORDEN letter ("A"); CrossFit ones by label ("BLOQUE 1"). */
function blockLabels(title: string): { badge: string; name: string } {
  if (/^[A-Z]{1,2}$/.test(title)) return { badge: title, name: `Bloque ${title}` };
  const number = title.match(/\d+/)?.[0];
  if (number) return { badge: number, name: title };
  const initials = title.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join("").slice(0, 2);
  return { badge: initials || "•", name: title || "Trabajo" };
}

function preview(block: Block) {
  const names = block.exercises.length ? block.exercises.map((e) => e.name) : block.lines;
  return names.slice(0, 3).join(" · ");
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180">
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExerciseItem({ exercise, block, extra }: { exercise: Exercise; block: string; extra?: RenderExtra }) {
  const { name, order, sets, reps, target, rest, interval, notes } = exercise;
  const volume = sets && reps ? `${sets}×${reps}` : sets ? `${sets} series` : reps;
  const tags = [target, interval].filter(Boolean);
  // "C. EMOM X 15 MIN" can be the name itself, or the INTERVALO column of a personalized plan.
  const timer = [name, interval].map((text) => (text ? timerFromText(text) : null)).find((config) => config) ?? undefined;
  // "B" repeats the block header; "B1" still tells the exercises of a superset apart.
  const showOrder = order && order !== block;

  // A line with nothing next to it is plain programming text (CrossFit).
  if (!volume && !tags.length && !rest && !notes && !order) {
    return (
      <li className={`py-2 ${SECTION.test(name) ? "pt-4 font-display text-lg font-bold tracking-wide text-accent first:pt-2" : ""}`}>
        <LinkedText text={name} />
        <TimerLink text={name} />
      </li>
    );
  }

  return (
    <li className="py-4 first:pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showOrder && <p className="font-display text-sm font-bold tracking-widest text-accent">{order}</p>}
          <p className="font-display text-xl leading-tight font-bold uppercase">
            <LinkedText text={name} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {volume && <p className="font-display text-2xl leading-none font-extrabold tabular-nums">{volume}</p>}
          <TimerButton
            config={timer}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-soft px-2.5 font-display text-sm font-bold tracking-wider text-accent uppercase active:bg-accent active:text-background"
          >
            <TimerIcon className="size-4" />
            Timer
          </TimerButton>
        </div>
      </div>
      {(tags.length > 0 || rest) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          {tags.map((tag) => (
            <span key={tag} className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">
              {tag}
            </span>
          ))}
          {rest && (
            <span className="inline-flex items-baseline gap-1.5 rounded-md border border-silver/30 px-2 py-0.5">
              <span className="text-xs font-semibold tracking-wider text-silver uppercase">Pausa</span>
              <span className="font-display text-base leading-none font-bold text-foreground">{rest}</span>
            </span>
          )}
        </div>
      )}
      {notes && (
        <p className="mt-2 text-sm whitespace-pre-line text-muted">
          <LinkedText text={notes} />
        </p>
      )}
      {extra?.(exercise)}
    </li>
  );
}

export function WorkoutBlocks({
  blocks,
  renderExtra,
  renderAside,
}: {
  blocks: Block[];
  renderExtra?: RenderExtra;
  renderAside?: RenderAside;
}) {
  if (!blocks.length) {
    return <p className="rounded-2xl border border-line bg-card p-5 text-muted">No hay ejercicios cargados para este día.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        const { badge, name } = blockLabels(block.title);
        return (
          <details key={`${block.title}-${i}`} className="group rounded-2xl border border-line bg-card open:border-accent/40">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 select-none">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent font-display text-xl font-extrabold text-background">
                {badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-widest text-muted uppercase">{name}</span>
                <span className="line-clamp-2 font-display text-xl leading-tight font-bold uppercase">{preview(block)}</span>
              </span>
              {renderAside?.(block)}
              <Chevron />
            </summary>
            <div className="border-t border-line px-4 pb-3">
              {block.lines.length > 0 && (
                <ul className="divide-y divide-line pt-1">
                  {block.lines.map((line, j) => (
                    <li
                      key={j}
                      className={`py-2 ${SECTION.test(line) ? "font-display text-lg font-bold tracking-wide text-accent" : ""}`}
                    >
                      <LinkedText text={line} />
                      <TimerLink text={line} />
                    </li>
                  ))}
                </ul>
              )}
              {block.exercises.length > 0 && (
                <ul className="divide-y divide-line">
                  {block.exercises.map((exercise, j) => (
                    <ExerciseItem key={j} exercise={exercise} block={block.title} extra={renderExtra} />
                  ))}
                </ul>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
