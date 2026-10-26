import Image from "next/image";

/** "LA FÁBRICA" in the logo colors: teal like its L, silver like its F. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-[0.08em] uppercase italic ${className}`}>
      <span className="text-accent">La</span> <span className="text-silver">Fábrica</span>
    </span>
  );
}

export function LogoMark({ size }: { size: number }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} priority className="shrink-0" />;
}
