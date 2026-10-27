"use client";

import { useState } from "react";
import type { ExerciseHistory } from "@/lib/history";
import { formatShortDate } from "./history-format";
import { ChevronIcon } from "./icons";
import { Sheet } from "./Sheet";

export type PickerItem = Pick<ExerciseHistory, "key" | "name" | "category"> & { lastAt?: string; days: number };

// Accents and case don't matter when searching ("olimpicos" finds "OLÍMPICOS").
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Button with the current exercise; opens a searchable list grouped by catalog category. */
export function ExercisePicker({ items, selected, onSelect }: { items: PickerItem[]; selected: PickerItem; onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const terms = fold(query).split(/\s+/).filter(Boolean);
  const matches = items.filter((item) => terms.every((t) => fold(`${item.name} ${item.category}`).includes(t)));
  const groups = new Map<string, PickerItem[]>();
  for (const item of matches) {
    const group = item.category || "Otros";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }

  function choose(key: string) {
    onSelect(key);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left active:border-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">Ejercicio</span>
          <span className="block truncate font-display text-3xl leading-tight font-extrabold uppercase">{selected.name}</span>
        </span>
        <ChevronIcon className="size-6 shrink-0 text-muted" />
      </button>

      {open && (
        <Sheet label="Elegir ejercicio" onDismiss={() => setOpen(false)} className="bg-background px-4 pt-4">
          <div className="flex items-center gap-2">
            <input
              type="search"
              autoFocus
              enterKeyHint="search"
              placeholder="Buscar ejercicio"
              aria-label="Buscar ejercicio"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-lg outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 px-2 font-display font-bold tracking-wider text-muted uppercase"
            >
              Cerrar
            </button>
          </div>

          {!matches.length && <p className="mt-6 text-center text-muted">Ningún ejercicio coincide con “{query}”.</p>}

          {[...groups].map(([group, list]) => (
            <section key={group} className="mt-5">
              <h2 className="font-display text-sm font-bold tracking-[0.2em] text-muted uppercase">{group}</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {list.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => choose(item.key)}
                      aria-current={item.key === selected.key ? "true" : undefined}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                        item.key === selected.key ? "bg-accent-soft" : "active:bg-card"
                      }`}
                    >
                      <span className={`min-w-0 flex-1 font-display text-lg font-bold uppercase ${item.days ? "" : "text-muted"}`}>
                        {item.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted tabular-nums">
                        {item.lastAt ? formatShortDate(item.lastAt) : "Sin registros"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Sheet>
      )}
    </>
  );
}
