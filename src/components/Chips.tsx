import Link from "next/link";

export type Chip = { label: string; href: string; active: boolean };

/** Horizontally scrollable row of links, used to pick a week, day or plan. */
export function Chips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-2">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex h-10 items-center rounded-full px-4 text-sm font-medium ${
                item.active ? "bg-foreground text-background" : "border border-line bg-card"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
