import { NextResponse } from "next/server";
import { findAthleteByEmail } from "@/lib/athletes";
import { createSessionCookie, SESSION_COOKIE, sessionCookieOptions, verifyFirebaseIdToken } from "@/lib/session";

/** Exchanges a Firebase ID token for our session cookie, if the email is an active athlete. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = typeof body?.idToken === "string" ? body.idToken : null;
  if (!idToken) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  let session;
  try {
    session = await verifyFirebaseIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const athlete = await findAthleteByEmail(session.email);
  if (!athlete) return NextResponse.json({ error: "not_enabled", email: session.email }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionCookie(session), sessionCookieOptions);
  return response;
}
