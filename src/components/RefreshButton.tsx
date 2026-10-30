"use client";

import { useTransition } from "react";
import { reloadFromSheetsAction } from "@/app/actions";
import { RefreshIcon } from "./icons";

/** Reads the plan from the sheets again, so a coach's change shows up right away. */
export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Actualizar"
      disabled={pending}
      onClick={() => startTransition(() => reloadFromSheetsAction())}
      className="grid size-10 place-items-center rounded-lg text-muted active:text-accent disabled:text-accent"
    >
      <RefreshIcon className={`size-5 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
