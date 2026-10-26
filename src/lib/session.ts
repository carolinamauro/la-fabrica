import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "marte_session";
const SESSION_DAYS = 30;

// Public keys Firebase uses to sign ID tokens.
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type Session = { email: string; name?: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const sessionKey = () => new TextEncoder().encode(requireEnv("SESSION_SECRET"));

/** Checks a Firebase ID token from the browser and returns who signed in. */
export async function verifyFirebaseIdToken(idToken: string): Promise<Session> {
  const projectId = requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const { payload } = await jwtVerify(idToken, firebaseKeys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("Firebase token has no verified email");
  }
  return { email: payload.email, name: typeof payload.name === "string" ? payload.name : undefined };
}

export async function createSessionCookie(session: Session): Promise<string> {
  return new SignJWT({ name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.email)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionKey());
}

export async function readSessionCookie(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, sessionKey(), { algorithms: ["HS256"] });
    return payload.sub ? { email: payload.sub, name: typeof payload.name === "string" ? payload.name : undefined } : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return readSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
