---
'@resonant-projects/clerk-solidjs': patch
---

Update Clerk dependencies to the Nov 3 releases: `@clerk/backend` 3.26.6 and `@clerk/shared` 4.44.0. `SignOutOptions` gains the internal option clerk-js uses for satellite sign-out; `signOut` already forwards options unchanged, so no code changes are needed. The Device Trust, Device Intelligence and custom OAuth provider fixes in these Clerk releases ship in clerk-js and `@clerk/ui`, not in this package. By default apps load both from the CDN by major version, so they get those fixes from Clerk; apps that pin a script version, bundle `@clerk/ui` or pass their own `Clerk` must update those themselves.
