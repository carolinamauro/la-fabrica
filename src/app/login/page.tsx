import { LogoMark, Wordmark } from "@/components/Brand";
import { LoginButton } from "./LoginButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between px-6 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)]">
      <div className="flex flex-col items-center text-center">
        <LogoMark size={200} />
        <h1>
          <Wordmark className="mt-4 block text-6xl leading-none" />
        </h1>
        <p className="mt-6 max-w-64 text-lg text-muted">Tu planificación, tus cargas. Todo en un lugar.</p>
      </div>
      <LoginButton />
    </main>
  );
}
