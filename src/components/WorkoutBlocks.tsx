import type { ReactNode } from "react";
import type { Block, Exercise } from "@/lib/types";

/** Extra content under an exercise (e.g. the Carga/Reps inputs of personalized plans). */
type RenderExtra = (exercise: Exercise) => ReactNode;

// Section headers in free text: "A. 3 RONDAS:", "C. EMOM X 15 MIN".
const SECTION = /^[A-Z]\d?\s*[.:]\s|:$/;

const URL_PATTERN = /(https?:\/\/\S+)/;

/** Text with its links made tappable (coaches paste exercise videos in notes). */
function LinkedText({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
        {/youtu\.?be/.test(part) ? "Ver video" : "Abrir link"}
      </a>
    ) : (
      part
    ),
  );
}

function blockTitle(title: string) {
  // Personalized blocks are named by the ORDEN letter only ("A", "B").
  return /^[A-Z]{1,2}$/.test(title) ? `Bloque ${title}` : title;
}

function ExerciseItem({ exercise, extra }: { exercise: Exercise; extra?: RenderExtra }) {
  const { name, order, sets, reps, target, rest, interval, notes } = exercise;
  const volume = sets && reps ? `${sets} × ${reps}` : sets ? `${sets} series` : reps;
  const details = [volume, target, interval].filter(Boolean);

  // A line with nothing next to it is plain programming text (CrossFit).
  if (!details.length && !rest && !notes && !order) {
    return (
      <li className={`py-1.5 ${SECTION.test(name) ? "pt-3 font-semibold first:pt-1.5" : ""}`}>
        <LinkedText text={name} />
      </li>
    );
  }

  return (
    <li className="py-3 first:pt-1.5">
      <div className="flex items-baseline gap-2">
        {order && <span className="text-xs font-semibold text-accent">{order}</span>}
        <span className="font-semibold">{name}</span>
      </div>
      {details.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {details.map((detail) => (
            <span key={detail} className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-medium">
              {detail}
            </span>
          ))}
        </div>
      )}
      {rest && <p className="mt-1.5 text-sm text-muted">Descanso: {rest}</p>}
      {notes && (
        <p className="mt-1 whitespace-pre-line text-sm text-muted">
          <LinkedText text={notes} />
        </p>
      )}
      {extra?.(exercise)}
    </li>
  );
}

export function WorkoutBlocks({ blocks, renderExtra }: { blocks: Block[]; renderExtra?: RenderExtra }) {
  if (!blocks.length) {
    return <p className="rounded-2xl bg-card p-5 text-muted">No hay ejercicios cargados para este día.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => (
        <section key={`${block.title}-${i}`} className="rounded-2xl bg-card p-4 shadow-sm">
          {block.title && (
            <h2 className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">{blockTitle(block.title)}</h2>
          )}
          {block.lines.length > 0 && (
            <ul className="divide-y divide-line">
              {block.lines.map((line, j) => (
                <li key={j} className={`py-1.5 ${SECTION.test(line) ? "font-semibold" : ""}`}>
                  <LinkedText text={line} />
                </li>
              ))}
            </ul>
          )}
          {block.exercises.length > 0 && (
            <ul className="divide-y divide-line">
              {block.exercises.map((exercise, j) => (
                <ExerciseItem key={j} exercise={exercise} extra={renderExtra} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
