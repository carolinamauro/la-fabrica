"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/firebase-client";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

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

  return (
    <div className="flex flex-col gap-4">
      {status.kind === "error" && (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          {status.message}
        </p>
      )}
      <button
        type="button"
        onClick={login}
        disabled={status.kind === "loading"}
        className="h-14 w-full rounded-full bg-foreground text-lg font-medium text-background disabled:opacity-60"
      >
        {status.kind === "loading" ? "Ingresando…" : "Continuar con Google"}
      </button>
    </div>
  );
}
