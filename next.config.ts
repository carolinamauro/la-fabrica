import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Google sign-in from the installed app goes to Google and back through the app's own domain
  // (see firebase-client.ts), so Firebase's auth pages are served from here.
  async rewrites() {
    const firebase = `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`;
    return [{ source: "/__/:path*", destination: `${firebase}/__/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
