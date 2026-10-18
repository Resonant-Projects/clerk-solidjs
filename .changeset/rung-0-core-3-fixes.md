---
'@resonant-projects/clerk-solidjs': minor
---

Fix features that did not work against Clerk Core 3 and SolidStart 2.

- Prop changes reach Clerk. Changing `appearance` or `localization` on `ClerkProvider`, or any prop of a mounted component, including custom pages and menu items, now updates it. Clerk Core 3 renamed the method this package called, so these changes were silently dropped.
- `useOrganization` and `useOrganizationList` load their lists. Pages and infinite lists work like `@clerk/react`: they are cached and shared across components, keep the previous page while loading when `keepPreviousData` is set, and are cleared when the user signs out. `fetchPage` is new. `useOrganization().isLoaded` is no longer inverted, so `membership` and the lists resolve. The package no longer depends on `@tanstack/solid-query`, so a page change no longer suspends the nearest `<Suspense>`.
- A session with pending tasks, such as choosing an organization, counts as signed out in `useAuth`, `<SignedIn>`, `<SignedOut>` and `<Protect>`, as in Clerk Core 3 and on the server. Pass `treatPendingAsSignedOut: false` to them to keep it signed in. `useSession().isSignedIn()` is `false` for such a session while `session()` still returns it, as in `@clerk/react`.
- `has()` checks features, plans and reverification, requires every requested role and permission, adds the `org:` prefix, and returns `false` instead of throwing when called without a role or permission. `useAuth` adds `orgSlug` and `sessionClaims`.
- `useUser` and `useSession` report `isSignedIn` as `undefined` while Clerk loads, instead of `true`.
- SolidStart: the server's auth state reaches the browser before hydration, so signed-in content no longer flashes away, and the publishable key and URLs the middleware resolved reach the client. Clerk's response headers, including refreshed session cookies, reach the response.
- clerk-js load errors are no longer stripped from production builds.
