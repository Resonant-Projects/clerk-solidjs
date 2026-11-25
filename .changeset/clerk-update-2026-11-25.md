---
"@resonant-projects/clerk-solidjs": minor
---

Update Clerk dependencies to the Nov 20 releases: `@clerk/backend` 3.31.4 and `@clerk/shared` 4.48.3.

**`signIn.clientTrustState` is available before Clerk loads.** As in `@clerk/react` 6.19.0, the `signIn` that `useSignIn()` returns has `clientTrustState` (`'new'`, `'known'` or `'pending'`), so a custom sign-in flow can read whether Clerk trusts the user's device. It is `undefined` until clerk-js has loaded, before the first factor is verified on instances with the Device Trust Status update, and when Device Trust is off.

**Passed through from Clerk.** `OAuthConsentInfo` gains optional `clientRegistration` and `clientMetadataHost` fields, and the appearance types gain the `oauthConsentClientIdentity` and `listGroupItemCheckbox` elements. ChatGPT is a supported OAuth strategy. On the server, `createSignInToken()` accepts `secondFactorVerification` (`'fresh' | 'stale'`) and `expiresInSeconds` is optional; `users.getUserList()` no longer waits for the user count when the page already shows the total; `auth({ acceptsToken })` with a token type that doesn't match now returns an auth object whose `debug()` holds the same redacted data as the original, and `authenticateRequest()` warns on an invalid `acceptsToken`.

clerk-js 6.46.x requests Frontend API version `2026-11-18`, and a session refresh when the tab regains focus can no longer overwrite newer state or set the session cookie again after sign-out. By default apps load clerk-js and `@clerk/ui` from the CDN by major version, so they get these from Clerk; apps that pin a script version, bundle `@clerk/ui` or pass their own `Clerk` must update those themselves.
