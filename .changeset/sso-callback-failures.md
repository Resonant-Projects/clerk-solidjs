---
"@resonant-projects/clerk-solidjs": patch
---

`HandleSSOCallback` no longer leaves the user on the callback route when a step fails. With clerk-js 6.42.3, `setActive` rejects with a network error, and `finalize()` returns it as `error`, when it cannot confirm a new session; before, the component ignored a failed `finalize()` and left a failed activation of an existing session as an unhandled rejection. Now a failed `finalize()`, a failed activation of an existing session or a request that throws calls `navigateToSignIn` or `navigateToSignUp` for the flow it came from, as a failed Protect challenge already does, so the user can try again. A failed `finalize()` keeps its error on `errors` from `useSignIn()` or `useSignUp()`, and development builds log the failure. The component never navigates to the app for a session that was not activated, and once the app's navigation has started it leaves the route to the app.
