"use client";

export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-4xl leading-none font-extrabold uppercase">No pudimos cargar tu planificación</h1>
      <p className="text-muted">Revisá tu conexión y probá de nuevo. Si sigue pasando, avisale a tu coach.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="h-14 rounded-xl bg-accent font-display text-xl font-extrabold tracking-wider text-background uppercase"
      >
        Reintentar
      </button>
    </main>
  );
}
