import { NextResponse, type NextRequest } from "next/server";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/session";

/** Sends visitors without a valid session to /login. */
export async function proxy(request: NextRequest) {
  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the login page, the session API, Firebase's sign-in pages (/__/) and static
  // assets requires a session.
  matcher: ["/((?!login|api/session|__/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|webmanifest)$).*)"],
};
