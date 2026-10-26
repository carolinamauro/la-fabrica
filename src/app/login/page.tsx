import { LoginButton } from "./LoginButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between px-6 pt-24 pb-12">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">MARTE</h1>
        <p className="mt-2 text-lg text-muted">Tu planificación de entrenamiento</p>
      </div>
      <LoginButton />
    </main>
  );
}
