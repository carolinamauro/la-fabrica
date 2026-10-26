/** Board-style heading: small accent label over a big condensed title ("SEMANA 2" / "DÍA 1"). */
export function DayTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="pt-1">
      {eyebrow && <p className="font-display text-sm font-bold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>}
      <h1 className="font-display text-5xl leading-none font-extrabold tracking-tight uppercase">{title}</h1>
    </div>
  );
}
