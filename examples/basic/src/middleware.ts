import { createMiddleware } from "@solidjs/start/middleware";
import { clerkMiddleware } from "@resonant-projects/clerk-solidjs/start/server";

// SolidStart 2's h3 middleware form. The keys come from VITE_CLERK_PUBLISHABLE_KEY
// and CLERK_SECRET_KEY, read per request; the sign-in and sign-up routes are below.
// The strict Content-Security-Policy's nonce goes to createHandler in
// src/entry-server.tsx.
export default createMiddleware([
  clerkMiddleware({
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    contentSecurityPolicy: { strict: true },
  }),
]);
