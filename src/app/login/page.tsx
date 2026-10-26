import { LoginButton } from "./LoginButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between px-6 pt-[calc(env(safe-area-inset-top)+6rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)]">
      <div>
        <div className="h-1.5 w-16 bg-accent" />
        <h1 className="mt-6 font-display text-8xl leading-[0.85] font-extrabold tracking-tight italic">MARTE</h1>
        <p className="mt-3 font-display text-xl font-bold tracking-[0.3em] text-accent uppercase">Training</p>
        <p className="mt-8 max-w-60 text-lg text-muted">Tu planificación, tus cargas. Todo en un lugar.</p>
      </div>
      <LoginButton />
    </main>
  );
}
