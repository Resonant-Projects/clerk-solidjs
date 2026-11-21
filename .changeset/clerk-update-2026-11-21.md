---
"@resonant-projects/clerk-solidjs": minor
---

Update Clerk dependencies to the Nov 16 releases: `@clerk/backend` 3.30.0 and `@clerk/shared` 4.46.0.

**`useReverification()` can pass what the reverification did.** As in `@clerk/shared` 4.46.0, `useReverification(fetcher, { passReverificationResult: true })` calls the fetcher with a `ReverificationResult` first (`undefined` on the first call), and the returned function takes the remaining arguments. clerk-js 6.44.0's reverification modal lets a user whose password was found in a data breach reverify by resetting it; `passwordReset` then holds the new password, which is already saved. Custom password change flows should use the option and not send the password again. With the option, `onNeedsReverification`'s `complete` takes the result to pass on, and the fetcher must accept `undefined` as its first argument. Options stored before they are passed use the new `UseReverificationResultOptions` type; `UseReverificationOptions`, `NeedsReverificationParameters` and calls without the option are unchanged. `ReverificationResult` and `NeedsReverificationResultParameters` are exported too, and the hook's telemetry reports the option, as `@clerk/react`'s does.

**Passed through from Clerk.** `clerkClient()` gains the experimental `oauthApplications.__experimental_exchangeToken()`, an OAuth 2.0 Token Exchange (RFC 8693) for an OAuth application. Invalid input throws an `OAuthTokenExchangeError` (from `@clerk/backend/errors`) before any request is sent. `session.prepareFirstFactorVerification()` and `session.attemptFirstFactorVerification()` accept the `reset_password_email_code` and `reset_password_phone_code` strategies.

The breached-password reset in the reverification modal, and a passkey sign-in that fails with `session_exists` now resuming the existing session, ship in clerk-js 6.44.0 and `@clerk/ui` 1.43.0. By default apps load clerk-js and `@clerk/ui` from the CDN by major version, so they get these from Clerk; apps that pin a script version, bundle `@clerk/ui` or pass their own `Clerk` must update those themselves.
