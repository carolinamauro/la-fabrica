import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { findAthleteByEmail } from "@/lib/athletes";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  // Rejected sign-ins land on /login?error=AccessDenied.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Only emails listed as ACTIVO in the master ATLETAS tab can sign in.
    async signIn({ user }) {
      if (!user.email) return false;
      return (await findAthleteByEmail(user.email)) !== null;
    },
    // Used by src/proxy.ts: unauthenticated visitors are sent to /login.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
