"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Brand";
import { signInWithGoogle } from "@/lib/firebase-client";

/** `entering`: signed in, waiting for the plan (read from the sheet) to show up. */
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "entering" } | { kind: "error"; message: string };

const CANCELLED = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

export function LoginButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function login() {
    setStatus({ kind: "loading" });
    try {
      const idToken = await signInWithGoogle();
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        // This page stays up until the plan is ready, so cover it with a loader meanwhile.
        setStatus({ kind: "entering" });
        router.replace("/");
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      setStatus({
        kind: "error",
        message:
          body.error === "not_enabled"
            ? `${body.email} no está habilitado. Probá con otra cuenta o pedile a tu coach que te agregue.`
            : "No pudimos iniciar sesión. Probá de nuevo.",
      });
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      if (CANCELLED.includes(code)) return setStatus({ kind: "idle" });
      setStatus({
        kind: "error",
        message:
          code === "auth/popup-blocked"
            ? "El navegador bloqueó la ventana de Google. Permití ventanas emergentes y probá de nuevo."
            : "No pudimos iniciar sesión. Probá de nuevo.",
      });
    }
  }

  if (status.kind === "entering") {
    return (
      <div
        role="status"
        className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
      >
        <div className="animate-pulse">
          <LogoMark size={120} />
        </div>
        <span className="size-8 animate-spin rounded-full border-3 border-line border-t-accent" aria-hidden />
        <p className="font-display text-2xl font-bold tracking-wider uppercase">Cargando tu planificación…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {status.kind === "error" && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {status.message}
        </p>
      )}
      <button
        type="button"
        onClick={login}
        disabled={status.kind === "loading"}
        className="h-14 w-full rounded-xl bg-accent font-display text-xl font-extrabold tracking-wider text-background uppercase active:translate-y-px disabled:opacity-60"
      >
        {status.kind === "loading" ? "Ingresando…" : "Continuar con Google"}
      </button>
    </div>
  );
}
