import { LogoMark, Wordmark } from "@/components/Brand";
import { LoginButton } from "./LoginButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between px-6 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)] short:max-w-3xl short:flex-row short:items-center short:gap-8 short:py-6">
      <div className="flex flex-col items-center text-center short:flex-1">
        {/* Smaller on its side, so the sign-in button fits next to it. */}
        <div className="short:[&_img]:size-28">
          <LogoMark size={200} />
        </div>
        <h1>
          <Wordmark className="mt-4 block text-6xl leading-none short:mt-2 short:text-5xl" />
        </h1>
        <p className="mt-6 max-w-64 text-lg text-muted short:mt-2">Tu planificación, tus cargas. Todo en un lugar.</p>
      </div>
      <div className="short:flex-1">
        <LoginButton />
      </div>
    </main>
  );
}
