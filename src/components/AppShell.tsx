import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";

/** Page frame: greeting + sign out on top, content, and an optional bar fixed at the bottom (thumb reach). */
export function AppShell({ name, children, bottom }: { name?: string; children: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-accent">MARTE</p>
          {name && <p className="text-lg font-semibold">Hola, {name}</p>}
        </div>
        <form action={signOutAction}>
          <button type="submit" className="h-10 rounded-full px-3 text-sm text-muted">
            Salir
          </button>
        </form>
      </header>

      <main className={`flex flex-1 flex-col gap-4 px-4 pt-2 ${bottom ? "pb-28" : "pb-8"}`}>{children}</main>

      {bottom && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto max-w-lg px-4 py-3">{bottom}</div>
        </div>
      )}
    </div>
  );
}

export function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 text-muted">{children}</p>}
    </div>
  );
}
