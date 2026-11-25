"use client";

import { useState } from "react";
import { liftName } from "@/lib/crossfit-log";
import { vibrate } from "@/lib/feedback";
import { CopyIcon, SearchIcon } from "./icons";
import { Sheet } from "./Sheet";

const URLS = /https?:\/\/\S+/g;

/** What to copy or look up: "4 BACK SQUAT (80%)" → "BACK SQUAT"; names without counts stay as they are. */
export function searchName(text: string): string {
  const clean = text.replace(URLS, "").trim();
  return liftName(clean) || clean.replace(/\s+/g, " ");
}

/** Copies, also where the Clipboard API isn't allowed (an old WebView, plain http). */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    return done;
  }
}

/**
 * An exercise's name that opens Copiar / Buscar en Google / YouTube when tapped, so it's easy to
 * look it up. Links written in the line (videos) stay separate, as links.
 */
export function ExerciseName({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = searchName(text);
  const links = text.match(URLS) ?? [];
  const shown = text.replace(URLS, "").trim();
  const query = encodeURIComponent(name);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className={`text-left select-text decoration-muted/50 decoration-dotted underline-offset-4 active:underline ${className ?? ""}`}
      >
        {shown}
        <SearchIcon className="ml-1.5 inline size-[0.7em] align-baseline text-muted/60" />
      </button>
      {links.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="ml-1.5 font-sans text-base font-semibold text-accent normal-case underline">
          {/youtu\.?be/.test(url) ? "Ver video" : "Abrir link"}
        </a>
      ))}

      {open && (
        <Sheet label={`Buscar ${name}`} onDismiss={() => setOpen(false)} className="gap-3 bg-background px-4 pt-4">
          <p className="font-display text-sm font-bold tracking-widest text-accent uppercase">Ejercicio</p>
          {/* Selectable too, to copy just a part of it. */}
          <p className="font-display text-3xl leading-tight font-bold uppercase select-text">{name}</p>
          {shown.toUpperCase() !== name && <p className="text-sm text-muted select-text">{shown}</p>}
          <button
            type="button"
            onClick={async () => {
              if (await copy(name)) {
                setCopied(true);
                vibrate(20);
              }
            }}
            className="mt-2 flex h-14 items-center justify-center gap-2 rounded-xl bg-accent font-display text-xl font-extrabold tracking-wider text-background uppercase"
          >
            <CopyIcon />
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/search?q=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-display text-lg font-bold tracking-wider uppercase"
            >
              <SearchIcon />
              Google
            </a>
            <a
              href={`https://www.youtube.com/results?search_query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line font-display text-lg font-bold tracking-wider uppercase"
            >
              <SearchIcon />
              YouTube
            </a>
          </div>
        </Sheet>
      )}
    </>
  );
}
