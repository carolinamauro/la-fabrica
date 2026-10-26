import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import { LogoMark, Wordmark } from "./Brand";

/**
 * Page frame: sticky wordmark bar with sign out (and optional plan tabs under it), content,
 * and an optional bar fixed at the bottom (thumb reach).
 */
export function AppShell({
  name,
  nav,
  children,
  bottom,
}: {
  name?: string;
  nav?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      {/* The iOS status bar is translucent, so the header pads itself below the notch. */}
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <LogoMark size={34} />
            <Wordmark className="text-xl whitespace-nowrap" />
            {name && <span className="truncate pl-1 text-sm text-muted">Hola, {name}</span>}
          </div>
          <form action={signOutAction}>
            <button type="submit" className="h-10 px-1 font-display text-sm font-bold tracking-wider text-muted uppercase">
              Salir
            </button>
          </form>
        </div>
        {nav}
      </header>

      <main className={`flex flex-1 flex-col gap-4 px-4 pt-4 ${bottom ? "pb-28" : "pb-10"}`}>{children}</main>

      {bottom && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto max-w-lg px-4 py-3">{bottom}</div>
        </div>
      )}
    </div>
  );
}

export function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line border-l-4 border-l-accent bg-card p-5">
      <p className="font-display text-xl font-bold uppercase">{title}</p>
      {children && <p className="mt-1 text-muted">{children}</p>}
    </div>
  );
}
