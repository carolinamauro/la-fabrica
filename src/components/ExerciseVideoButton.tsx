"use client";

import { useState } from "react";
import type { ExerciseVideo } from "@/lib/video";
import { PlayIcon } from "./icons";
import { Sheet } from "./Sheet";

/** "Cómo se hace": opens the exercise's video (LINKS column) in a sheet, loaded only when asked. */
export function ExerciseVideoButton({ name, video }: { name: string; video: ExerciseVideo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-accent/40 px-2.5 font-display text-sm font-bold tracking-wider text-accent uppercase active:bg-accent active:text-background"
      >
        <PlayIcon className="size-3.5" />
        Cómo se hace
      </button>

      {open && (
        <Sheet label={`Cómo se hace ${name}`} onDismiss={() => setOpen(false)} className="gap-4 bg-background px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-widest text-accent uppercase">Cómo se hace</p>
              <h2 className="font-display text-2xl leading-tight font-bold uppercase">{name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 shrink-0 rounded-lg border border-line px-3 font-display font-bold tracking-wider text-muted uppercase"
            >
              Cerrar
            </button>
          </div>

          <Player video={video} title={name} />

          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={
              video.kind === "link"
                ? "grid h-14 place-items-center rounded-xl bg-accent font-display text-xl font-extrabold tracking-wider text-background uppercase"
                : "text-center text-sm text-muted underline"
            }
          >
            {video.kind === "link" ? "Abrir el video" : `¿No se ve? Abrilo en ${video.source}`}
          </a>
        </Sheet>
      )}
    </>
  );
}

function Player({ video, title }: { video: ExerciseVideo; title: string }) {
  if (video.kind === "file") {
    return <video src={video.src} controls playsInline autoPlay className="w-full rounded-2xl bg-black" />;
  }
  if (video.kind === "link") {
    return <p className="text-muted">Este video no se puede ver dentro de la app. Abrilo en {video.source}.</p>;
  }
  return (
    <div
      className={`mx-auto w-full overflow-hidden rounded-2xl border border-line bg-black ${
        video.vertical ? "aspect-[9/16] max-h-[65dvh] max-w-[calc(65dvh*9/16)]" : "aspect-video"
      }`}
    >
      <iframe
        src={video.src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
