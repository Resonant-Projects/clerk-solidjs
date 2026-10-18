---
"@resonant-projects/clerk-solidjs": major
---

Session tasks, the SSO callback, and the 4.0 removals. See MIGRATION.md for each change.

- **Breaking: `SignedIn`, `SignedOut` and `Protect` are removed.** Use `<Show when="signed-in">`, `<Show when="signed-out">` and `<Show when={{ role }}>` or `<Show when={(has) => …}>`, as in `@clerk/react` 6.
- **Breaking: the Core 2 `afterSignInUrl` and `afterSignUpUrl` props are removed**, from `ClerkProvider`, the SolidStart provider and `clerkMiddleware()`. Use `signInFallbackRedirectUrl` and `signUpFallbackRedirectUrl`. `CLERK_AFTER_SIGN_IN_URL` and `CLERK_AFTER_SIGN_UP_URL` are no longer read.
- **Breaking: ESM only.** The package has no CommonJS builds or `require` conditions. Each CommonJS entry carried its own copy of the Clerk contexts.
- **Breaking: peers.** `solid-js` `^1.9`. `@solidjs/start` `^2` and `@solidjs/router` `>=0.16 <2` are optional peers, used by the `/start` entries.
- **Breaking: `useClerk()()`'s `__unstable__environment`, `__unstable__setEnvironment` and `__unstable__updateProps` are removed.** Use the `__internal_` members.
- **New: session tasks.** `TaskChooseOrganization`, `TaskResetPassword` and `TaskSetupMFA` mount Clerk's task components. `RedirectToTasks`, and `buildTasksUrl()` and `redirectToTasks()` on `useClerk()()`, send the user to them. Core 3 treats a session with pending tasks as signed out.
- **New: `HandleSSOCallback`** finishes an OAuth or enterprise SSO sign-in or sign-up on its callback route with the Core 3 resources. It resolves a pending bot-protection check, then finalizes, transfers between sign-in and sign-up, or hands off to your sign-in or sign-up page. `useClerk()()` also gains `setProtectAssertion()` and the protect-check members it uses.
