---
"@resonant-projects/clerk-solidjs": major
---

Clerk Core 3's signal-based hooks, and the rest of the Clerk instance.

- **Breaking: `useSignIn()` and `useSignUp()`** are Core 3's signal-based hooks, as in `@clerk/react` 6. They return `{ signIn, errors, fetchStatus }` and `{ signUp, errors, fetchStatus }`, kept current from clerk-js's signals. Their methods, such as `signIn.password()` and `signUp.verifications.sendEmailCode()`, wait for Clerk to load. On the server they return defaults. The resource and `errors` stay reactive when destructured; read `fetchStatus` from the result.

  The Core 2 hooks, with `isLoaded`, the client's resource and `setActive`, move to a new `./legacy` entry, like `@clerk/react/legacy`:

  ```diff
  -import { useSignIn } from '@resonant-projects/clerk-solidjs';
  +import { useSignIn } from '@resonant-projects/clerk-solidjs/legacy';
  ```

- **New `useWaitlist()`:** `{ waitlist, errors, fetchStatus }`. Join with `waitlist.join({ emailAddress })`.
- **New `useReverification(fetcher, options?)`:** wraps a call that may need the user to verify again. It opens Clerk's reverification modal, or calls `onNeedsReverification`, then runs the call once more.
- **Clerk instance:** `useClerk()` now also has `authenticateWithBase()`, `authenticateWithSolana()`, `apiKeys`, `oauthApplication`, `uiVersion`, `openInviteMembers()` and the enable-organizations prompt. It can also mount the UserAvatar, APIKeys, OAuthConsent, OAuth device verification, SSO and directory sync components; their Solid components come in a later release. Calls made before clerk-js loads wait for it. `addListener()` keeps its options until then, and `__internal_getOption()` reads the provider's options until then. Errors loading clerk-js name this package.
