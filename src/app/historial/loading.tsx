export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]"
      aria-busy="true"
      aria-label="Cargando historial"
    >
      <div className="h-6 w-24 animate-pulse rounded bg-accent/30" />
      <div className="h-18 animate-pulse rounded-2xl border border-line bg-card" />
      <div className="h-24 animate-pulse rounded-2xl border border-line bg-card" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
      {[0, 1].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl border border-line bg-card" />
      ))}
    </div>
  );
}
