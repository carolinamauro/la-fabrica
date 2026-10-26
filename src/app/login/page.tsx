import { signIn } from "@/auth";

export default function LoginPage() {
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

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="h-14 w-full rounded-full bg-foreground text-lg font-medium text-background"
        >
          Continuar con Google
        </button>
      </form>
    </main>
  );
}
