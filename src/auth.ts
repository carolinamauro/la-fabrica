import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    // Used by src/proxy.ts: unauthenticated visitors are sent to /login.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
