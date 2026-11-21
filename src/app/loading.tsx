/** Placeholders shaped like the day screen (chips, title, progress card, blocks), with a light sweeping across. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]"
      aria-busy="true"
      aria-label="Cargando"
    >
      <p role="status" className="sr-only">
        Cargando tu planificación…
      </p>
      <div className="flex h-10 items-center gap-2">
        <div className="skeleton size-9 rounded-full" />
        <div className="skeleton h-5 w-32 rounded" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-10 w-24 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-10 w-20 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="skeleton h-3.5 w-20 rounded bg-accent/20" />
        <div className="skeleton h-11 w-36 rounded-lg" />
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-card/70 p-3">
        <div className="skeleton size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton h-3.5 w-28 rounded" />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3" style={{ opacity: 1 - i * 0.18 }}>
          <div className="skeleton size-10 rounded-lg bg-accent/25" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-5 w-44 rounded" />
          </div>
          <div className="skeleton size-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}
