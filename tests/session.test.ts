import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createSessionCookie, readSessionCookie, verifyFirebaseIdToken } from "../src/lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
});

describe("session cookie", () => {
  it("round-trips the signed-in email and name", async () => {
    const cookie = await createSessionCookie({ email: "ana@test.com", name: "Ana" });
    expect(await readSessionCookie(cookie)).toEqual({ email: "ana@test.com", name: "Ana" });
  });

  it("rejects missing, tampered and foreign cookies", async () => {
    const cookie = await createSessionCookie({ email: "ana@test.com" });
    const [header, , signature] = cookie.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "other@test.com" })).toString("base64url");
    const signedElsewhere = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("ana@test.com")
      .sign(new TextEncoder().encode("another-secret-at-least-32-characters"));

    expect(await readSessionCookie(undefined)).toBeNull();
    expect(await readSessionCookie("garbage")).toBeNull();
    expect(await readSessionCookie(`${header}.${forgedPayload}.${signature}`)).toBeNull();
    expect(await readSessionCookie(signedElsewhere)).toBeNull();
  });

  it("rejects expired cookies", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("ana@test.com")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await readSessionCookie(expired)).toBeNull();
  });
});

describe("verifyFirebaseIdToken", () => {
  it("rejects tokens not signed by Firebase", async () => {
    const fake = await new SignJWT({ email: "ana@test.com", email_verified: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://securetoken.google.com/test-project")
      .setAudience("test-project")
      .sign(new TextEncoder().encode("attacker-secret-at-least-32-characters"));
    await expect(verifyFirebaseIdToken(fake)).rejects.toThrow();
  });
});
