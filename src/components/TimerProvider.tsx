"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { DEFAULTS, type TimerConfig } from "@/lib/timer";
import { Timer } from "./Timer";

/** "open": the sheet (setup or running clock); "minimized": a running clock docked at the bottom. */
type View = "closed" | "open" | "minimized";

const OpenTimer = createContext<(config?: TimerConfig) => void>(() => {});

/**
 * The timer floats over every page (it lives in the root layout), so the athlete can open it,
 * dock it at the bottom while it runs and keep browsing the plan.
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("closed");
  const [initial, setInitial] = useState<TimerConfig>(DEFAULTS.amrap);
  // A fresh setup each time the timer is opened from scratch.
  const [session, setSession] = useState(0);

  const open = useCallback(
    (config?: TimerConfig) => {
      // A docked clock comes back as it is, whatever button was tapped.
      if (view !== "minimized") {
        setInitial(config ?? DEFAULTS.amrap);
        setSession((n) => n + 1);
      }
      setView("open");
    },
    [view],
  );

  return (
    <OpenTimer value={open}>
      {children}
      {view !== "closed" && (
        <Timer
          key={session}
          initial={initial}
          minimized={view === "minimized"}
          onMinimize={() => setView("minimized")}
          onExpand={() => setView("open")}
          onClose={() => setView("closed")}
        />
      )}
    </OpenTimer>
  );
}

/** Opens the timer, set up with `config` when given (e.g. the EMOM a workout line names). */
export function TimerButton({ config, className, children, ...rest }: { config?: TimerConfig; className?: string; children: ReactNode; "aria-label"?: string }) {
  const open = useContext(OpenTimer);
  return (
    <button type="button" onClick={() => open(config)} className={className} {...rest}>
      {children}
    </button>
  );
}
