"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { LogoMark } from "./Brand";
import { ShareIcon } from "./icons";

// Chrome and Edge offer their own install dialog through this event; Safari has no API for it.
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

/** The browser's own install dialog, or the steps to do it by hand where there is none. */
type Way = "prompt" | Manual;
type Manual = "ios" | "macSafari" | "menu";

/** How this browser can add the app to the home screen, or null when it can't or already did. */
function installWay(): Way | null {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (installed || standalone || isDismissed()) return null;
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but with touch.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "macSafari";
  // Firefox on a computer can't install web apps.
  if (/Firefox/.test(ua) && !/Android/.test(ua)) return null;
  // Chrome/Edge without the event yet (or that already installed it), and other mobile browsers.
  return "menu";
}

const STEPS: Record<Manual, ReactNode[]> = {
  ios: [
    <>
      Tocá <ShareIcon className="inline size-5 align-text-bottom text-accent" /> <b>Compartir</b> en la barra del navegador.
    </>,
    <>
      Elegí <b>Agregar a inicio</b> (o “Agregar a pantalla de inicio”).
    </>,
    <>
      Tocá <b>Agregar</b>.
    </>,
  ],
  macSafari: [
    <>
      En la barra de menú, abrí <b>Archivo</b>.
    </>,
    <>
      Elegí <b>Agregar al Dock</b>.
    </>,
    <>
      Confirmá con <b>Agregar</b>.
    </>,
  ],
  menu: [
    <>
      Abrí el menú del navegador (<b>⋮</b> o <b>⋯</b>), o el ícono de instalar en la barra de direcciones.
    </>,
    <>
      Elegí <b>Instalar La Fábrica</b> (o “Agregar a pantalla de inicio”).
    </>,
    <>
      Confirmá con <b>Instalar</b>.
    </>,
  ],
};

/** Card inviting the athlete to install La Fábrica (home screen, Dock or desktop), like a native app. */
export function InstallApp() {
  const way = useSyncExternalStore(subscribe, installWay, () => null);
  const [steps, setSteps] = useState(false);
  if (!way) return null;

  async function install() {
    if (way !== "prompt") return setSteps(true);
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
          <p className="text-sm leading-snug text-muted">Tenela a un toque, con su ícono, como una app.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ahora no" className="grid size-9 shrink-0 place-items-center self-start text-muted">
          ✕
        </button>
      </div>
      {steps && way !== "prompt" ? (
        <ol className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-sm">
          {STEPS[way].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <button
          type="button"
          onClick={install}
          className="mt-3 h-11 w-full rounded-lg bg-accent font-display text-base font-extrabold tracking-wider text-background uppercase active:translate-y-px"
        >
          Instalar app
        </button>
      )}
    </section>
  );
}
