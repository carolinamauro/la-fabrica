"use client";

import { useState, useSyncExternalStore } from "react";
import { LogoMark } from "./Brand";
import { ShareIcon } from "./icons";

// Chrome/Android offer their own install dialog through this event; iOS has no API for it.
type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "install-dismissed";

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Listen from when the bundle loads: the event can fire before the card mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private mode: it stays hidden until the page reloads.
  }
  installed = true;
  notify();
}

type Way = "prompt" | "ios" | null;

/** How this browser can add the app to the home screen, or null when it can't or already did. */
function installWay(): Way {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (installed || standalone || isDismissed()) return null;
  if (deferred) return "prompt";
  // iPadOS reports itself as a Mac, but with touch.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : null;
}

/** Card inviting the athlete to add La Fábrica to the home screen, like a native app. */
export function InstallApp() {
  const way = useSyncExternalStore(subscribe, installWay, () => null);
  const [steps, setSteps] = useState(false);
  if (!way) return null;

  async function install() {
    if (way === "ios") return setSteps((open) => !open);
    await deferred?.prompt();
    // The event works once; Chrome fires a new one if the app is still installable.
    deferred = null;
    notify();
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-3">
      <div className="flex items-center gap-3">
        <LogoMark size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-bold uppercase">Instalá La Fábrica</p>
          <p className="text-sm leading-snug text-muted">Abrila desde tu pantalla de inicio, como una app.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ahora no" className="grid size-9 shrink-0 place-items-center self-start text-muted">
          ✕
        </button>
      </div>
      {steps ? (
        <ol className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-sm">
          <li className="flex items-start gap-2">
            <Step n={1} />
            <span>
              Tocá <ShareIcon className="inline size-5 align-text-bottom text-accent" /> <b>Compartir</b> en la barra del navegador.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Step n={2} />
            <span>
              Elegí <b>Agregar a inicio</b> (o “Agregar a pantalla de inicio”).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Step n={3} />
            <span>
              Tocá <b>Agregar</b>.
            </span>
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={install}
          className="mt-3 h-11 w-full rounded-lg bg-accent font-display text-base font-extrabold tracking-wider text-background uppercase active:translate-y-px"
        >
          Agregar a inicio
        </button>
      )}
    </section>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">{n}</span>
  );
}
