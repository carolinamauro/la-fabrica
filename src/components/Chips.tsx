import Link from "next/link";
import { ViewTransition } from "react";
import { direction } from "./transitions";

export type Chip = { label: string; href: string; active: boolean };

/** "Días" → "dias", a valid view-transition-name. */
const slug = (text: string) => text.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

/**
 * Horizontally scrollable row of links, used to pick a week, day or plan. Picking a later one
 * slides the page left (an earlier one, right), and the highlight glides to the new chip.
 */
export function Chips({ items, label }: { items: Chip[]; label: string }) {
  const active = items.findIndex((item) => item.active);
  return (
    <nav aria-label={label} data-no-swipe className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-2">
        {items.map((item, i) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              transitionTypes={direction(i, active)}
              aria-current={item.active ? "page" : undefined}
              className={`relative flex h-10 items-center rounded-xl px-4 font-display text-base font-bold tracking-wider uppercase transition-colors ${
                item.active ? "text-background" : "border border-line bg-card/80 text-muted active:border-accent/60 active:text-foreground"
              }`}
            >
              {item.active && (
                <ViewTransition name={`chip-${slug(label)}`} share="chip" default="none">
                  <span aria-hidden className="absolute inset-0 rounded-xl bg-accent shadow-[0_6px_20px_-8px_var(--accent)]" />
                </ViewTransition>
              )}
              <span className="relative">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
