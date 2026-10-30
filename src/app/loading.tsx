export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]"
      aria-busy="true"
      aria-label="Cargando"
    >
      <p role="status" className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-muted uppercase">
        <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
        Cargando tu planificación…
      </p>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-card" />
        ))}
      </div>
      <div className="h-12 w-40 animate-pulse rounded bg-card" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-18 animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </div>
  );
}
