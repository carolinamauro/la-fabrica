export { auth as proxy } from "@/auth";

export const config = {
  // Everything except the login page, Auth.js routes and static assets requires a session.
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|webmanifest)$).*)"],
};
