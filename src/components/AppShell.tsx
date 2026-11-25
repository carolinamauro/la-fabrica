import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import { LogoMark, Wordmark } from "./Brand";
import { Slide } from "./DayNav";
import { TimerIcon } from "./icons";
import { InstallApp } from "./InstallApp";
import { KeepFresh } from "./KeepFresh";
import { PullToRefresh } from "./PullToRefresh";
import { TimerButton } from "./TimerProvider";

/**
 * Page frame: sticky wordmark bar with sign out (and optional plan tabs under it), content,
 * and an optional bar fixed at the bottom (thumb reach).
 */
export function AppShell({
  name,
  nav,
  children,
  bottom,
  section = "page",
}: {
  name?: string;
  nav?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
  /** Changing it within a page (CrossFit's Entrenamiento / Anexo) slides the content like a new section. */
  section?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col short:max-w-4xl">
      <KeepFresh />
      <PullToRefresh />
      {/* The iOS status bar is translucent, so the header pads itself below the notch. */}
      {/* Named so it stays put while the content slides between sections (globals.css). */}
      <header
        style={{ viewTransitionName: "site-header" }}
        className="sticky top-0 z-10 border-b border-line bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl short:static"
      >
        <div className="flex h-14 items-center justify-between pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] short:h-12">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <LogoMark size={34} />
            <Wordmark className="text-xl whitespace-nowrap" />
            {name && <span className="truncate pl-1 text-sm text-muted">Hola, {name}</span>}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <TimerButton aria-label="Timer" className="grid size-10 place-items-center rounded-lg text-accent">
              <TimerIcon />
            </TimerButton>
            <form action={signOutAction}>
              <button type="submit" className="h-10 px-1 font-display text-sm font-bold tracking-wider text-muted uppercase">
                Salir
              </button>
            </form>
          </div>
        </div>
        {nav}
      </header>

      <main
        className={`flex flex-1 flex-col gap-4 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] ${bottom ? "pb-28 short:pb-20" : "pb-10"}`}
      >
        <InstallApp />
        {/* page-in: arriving at a section from another route (through its loading screen) fades it up. */}
        <Slide id={section} className="page-in flex flex-col gap-4">
          {children}
        </Slide>
      </main>

      {bottom && (
        <div
          data-bottom-bar
          style={{ viewTransitionName: "bottom-bar" }}
          className="fixed inset-x-0 bottom-0 border-t border-line bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        >
          <div className="mx-auto max-w-lg px-4 py-3 short:max-w-4xl short:py-1.5">{bottom}</div>
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
