"use client";

import { useEffect } from "react";
import "./globals.css";

const RELOADED_AT = "global-error-reloaded-at";

/**
 * Replaces the whole app when even the root layout fails (otherwise the screen stays black,
 * e.g. an app resumed from the background after a new version was deployed). Reloads once on
 * its own, which almost always fixes it, and offers a button after that.
 */
export default function GlobalError() {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(RELOADED_AT, String(Date.now()));
      location.reload();
    } catch {
      // No storage (private mode): just show the button.
    }
  }, []);

  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6">
          <h1 className="text-4xl leading-none font-extrabold uppercase">No pudimos abrir la app</h1>
          <p className="text-muted">Probá de nuevo. Si sigue pasando, cerrala y volvé a abrirla.</p>
          <button
            type="button"
            // A full reload, not retry(): the usual cause is stale code that only a fresh load fixes.
            onClick={() => location.reload()}
            className="h-14 rounded-xl bg-accent text-xl font-extrabold tracking-wider text-background uppercase"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
