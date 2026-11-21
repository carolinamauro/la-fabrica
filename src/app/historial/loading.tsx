export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]"
      aria-busy="true"
      aria-label="Cargando historial"
    >
      <div className="h-6 w-24 skeleton rounded bg-accent/20" />
      <div className="h-18 skeleton rounded-2xl border border-line" />
      <div className="h-24 skeleton rounded-2xl border border-line" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 skeleton rounded-2xl border border-line" />
        ))}
      </div>
      <div className="h-64 skeleton rounded-2xl border border-line" />
      {[0, 1].map((i) => (
        <div key={i} className="h-16 skeleton rounded-2xl border border-line" />
      ))}
    </div>
  );
}
