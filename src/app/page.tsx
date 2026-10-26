import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="flex flex-1 flex-col justify-between px-6 pt-16 pb-12">
      <div>
        <p className="text-zinc-600 dark:text-zinc-400">Hola,</p>
        <h1 className="text-3xl font-bold tracking-tight">{session?.user?.name}</h1>
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Pronto vas a ver tu planificación acá.
        </p>
      </div>

      <form action={signOutAction}>
        <button
          type="submit"
          className="h-12 w-full rounded-full border border-zinc-300 font-medium dark:border-zinc-700"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
