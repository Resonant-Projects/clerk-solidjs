---
"@resonant-projects/clerk-solidjs": minor
---

Security and infrastructure options for `clerkMiddleware()`, as `@clerk/nextjs` has:

- **`frontendApiProxy`** serves Clerk's Frontend API from your app, at `/__clerk` by default, for networks that block it. Unless you pass a `proxyUrl`, the browser uses the proxy too.
- **`contentSecurityPolicy`** sets a `Content-Security-Policy` that allows Clerk, merged with your directives, with report-only and reporting options. In strict mode the per-request nonce is in `event.locals.clerkNonce`; pass it to SolidStart's `createHandler`.
- **`debug`** logs each request's options, request state and auth, without credentials: keys cut short, cookies by name, URLs without parameter values, and headers that could carry a credential by name only.
- **Netlify:** a handshake redirect on a development instance busts Netlify's cache, as the other Clerk SDKs do.
- **`./start/server` in the browser:** a browser build gets a stand-in with the same exports, which throw when called. Route files can still import `auth` for their `"use server"` functions, and `@clerk/backend` stays out of the browser bundle.
