---
"@resonant-projects/clerk-solidjs": minor
---

SolidStart 2 server parity.

- **h3 middleware:** `clerkMiddleware()` works as a SolidStart 2 h3 middleware: `createMiddleware([clerkMiddleware()])`. The `createMiddleware({ onRequest: [...] })` form, and calling it with a FetchEvent yourself, work as before.
- **Response headers:** in both forms, Clerk's response headers (session-refresh cookies and `x-clerk-auth-*`) now reach every response, including 4xx and 5xx ones, errors and h3's 404. They used to be dropped from those.
- **Options:** every `authenticateRequest()` option is forwarded, such as `organizationSyncOptions`, `satelliteAutoSync`, `clockSkewInMs`, `jwksCacheTtlInMs`, `skipJwksCache`, `headerType`, `issuer` and `machineSecretKey`. Options can come from a function called per request with `{ url, event }`.
- **Env:** variables are read per request through `@clerk/shared/getEnvVariable`, which adds the Cloudflare and `globalThis` fallbacks. It also adds `CLERK_MACHINE_SECRET_KEY`, `CLERK_UNSAFE_DISABLE_DEVELOPMENT_MODE_CONSOLE_WARNING` and `CLERK_CHECKOUT_CONTINUE_URL`. `@clerk/backend` is now ^3.25.
- **Typed `auth()`:** it is typed like `@clerk/backend`'s `GetAuthFnNoRequest`, so `const { userId } = auth()` type-checks. It takes `{ acceptsToken, treatPendingAsSignedOut }`. API keys, M2M tokens and OAuth access tokens are authenticated, and `auth({ acceptsToken: 'api_key' })` returns them. `auth()` with no options still returns the session object.
- **Redirect helpers:** session auth objects have `redirectToSignIn()` and `redirectToSignUp()`. You can `throw` them from a `"use server"` query, and they come back to the current page.
- **`event.locals.auth` typing:** add `/// <reference types="@resonant-projects/clerk-solidjs/start/env" />` to a `.d.ts` file to type `event.locals.auth` through `App.RequestEventLocals`. It replaces the old augmentation, which typed nothing. The typing is opt-in, so an app that declares its own `auth` there keeps compiling.
- **New `./webhooks` entry:** it exports `verifyWebhook`.
- **`/start/server` exports:** `clerkClient(options?)` takes optional options and reads the env when called. `/start/server` also exports `verifyToken`, `createClerkClient`, `reverificationError`, `reverificationErrorResponse` and the `ClerkMiddlewareOptions` type. A missing secret key or middleware now gives an actionable error.
- **`/start` components:** `/start` exports `SignIn`, `SignUp`, `UserProfile`, `OrganizationProfile` and `OrganizationList` with path routing taken from the current route. On a catch-all route they need no `path` prop.
- **Navigation:** the SolidStart `ClerkProvider`'s navigation now resolves once the router has finished navigating. It used to resolve immediately, and its resolver list grew without bound.
