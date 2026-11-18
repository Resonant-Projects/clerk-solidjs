---
"@resonant-projects/clerk-solidjs": minor
---

Update Clerk dependencies to the Nov 12 and Nov 14 releases: `@clerk/backend` 3.29.0 and `@clerk/shared` 4.45.1.

**Session tokens need a `cat` header.** With `@clerk/backend` 3.28.0, a JWT without a `cat` header is no longer accepted as a session token. `clerkMiddleware()` treats such a request as signed out (reason `token-type-mismatch`), and `verifyToken()` from `@resonant-projects/clerk-solidjs/start/server` rejects with `token-invalid`. This includes OIDC `id_token`s issued by Clerk. Session tokens from Clerk already carry the header. Tests or tools that sign their own session tokens must add `cat: 'cl_B7d4PD111AAA'` to the JWT header.

**Poppy discovery.** `clerkMiddleware({ poppy: true })` serves `/.well-known/poppy.json` and `/.well-known/oauth-protected-resource` from `clerkClient().artifacts.getPoppyJson()`, before authenticating, as `@clerk/nextjs` 7.10.0 does. Only GET is allowed; other methods get a 405. With `poppy` off, those paths are left to the app. Clerk marks `poppy` a preview that may change while the Personal Agent Protocol is a draft. Signed-in agent sessions now carry `agent` (`{ type: 'agent', sub, task_id? }`) on `auth()` and `event.locals.auth`, with or without `poppy`.

**Passed through from Clerk.** `clerkClient()` gains `sessions.updateSession()`, `users.mergeUser()`, `artifacts.getPoppyJson()`, `startingAfter` on `users.getUserList()`, and `selfServeSsoEnabled` / `selfServeDirectorySyncEnabled` on `organizations.updateOrganization()`. `verifyWebhook()` from `@resonant-projects/clerk-solidjs/webhooks` narrows the `user.merged` event. `signIn.passkey()` and the legacy `signIn.authenticateWithPasskey()` accept `preferImmediatelyAvailableCredentials`, and `ClerkAPIResponseError` errors carry `meta.providerError`.

The fixes in clerk-js 6.43.1 and `@clerk/ui` 1.42.6 ship in those packages. They include `handleRedirectCallback()` sharing one transfer when called again during an OAuth callback, and `<SignIn />` no longer showing "The External Account was not found." when a sign-up transfer is blocked. By default apps load clerk-js and `@clerk/ui` from the CDN by major version, so they get these fixes from Clerk; apps that pin a script version, bundle `@clerk/ui` or pass their own `Clerk` must update those themselves.
