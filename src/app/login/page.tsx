import { signIn } from "@/auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <main className="flex flex-1 flex-col justify-between px-6 pt-24 pb-12">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">MARTE</h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          Tu planificación de entrenamiento
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
            {error === "AccessDenied"
              ? "Tu email no está habilitado. Pedile a tu coach que te agregue."
              : "No pudimos iniciar sesión. Probá de nuevo."}
          </p>
        )}

        <form action={signInWithGoogle}>
        <button
          type="submit"
          className="h-14 w-full rounded-full bg-foreground text-lg font-medium text-background"
        >
          Continuar con Google
        </button>
        </form>
      </div>
    </main>
  );
}
