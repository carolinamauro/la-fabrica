/** Pointing down; rotate it for up. */
export function ChevronIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The iOS share button (box with an arrow up). */
export function ShareIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
    </svg>
  );
}

/** Stopwatch, for links to the timer. */
export function TimerIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M10 2h4M12 2v3" />
    </svg>
  );
}

/** Circular arrow, for pull to refresh. */
export function RefreshIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" />
    </svg>
  );
}

/** Play triangle, for exercise videos. */
export function PlayIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M4 2.5v11a.5.5 0 0 0 .76.43l9-5.5a.5.5 0 0 0 0-.86l-9-5.5A.5.5 0 0 0 4 2.5Z" />
    </svg>
  );
}
