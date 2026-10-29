---
'@resonant-projects/clerk-solidjs': patch
---

Update Clerk dependencies to the Oct 27 releases (`@clerk/backend` 3.26.4, `@clerk/shared` 4.43.0, `@clerk/clerk-js` 6.42.0, `@clerk/localizations` 4.24.3, `@clerk/ui` 1.42.1, `@clerk/testing` 2.2.52) and refresh `@tanstack/query-core` to 5.105.0. This brings in the optional `slackTeamIdHint` for Slack sign-in and sign-up (`signIn.sso()`, `signIn.create()`, `signUp.sso()`, `signUp.create()`, and the redirect/popup flows), `selfServeDirectorySyncEnabled` on organizations returned by `useOrganization()`, and clerk-js's fix for `getToken()` returning an expired token when the device clock runs behind.
