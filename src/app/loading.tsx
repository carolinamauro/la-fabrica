export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-16 animate-pulse rounded bg-line" />
      <div className="h-6 w-40 animate-pulse rounded bg-line" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-20 animate-pulse rounded-full bg-line" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}
