---
"@resonant-projects/clerk-solidjs": patch
---

**`handleRedirectCallback()` and `handleGoogleOneTapCallback()` now return clerk-js's result.** As in `@clerk/react` 6.19.4, both wait for clerk-js to load, resolve with what clerk-js returns once it has finished, and pass an optional `customNavigate` through to clerk-js. Before, they resolved right away with nothing, and dropped `customNavigate`.

**Awaiting callers now see rejections.** When clerk-js fails to handle the callback, the promise rejects with its error; before, the error was swallowed. Code that awaits either method should catch it. A call made before clerk-js loads now stays pending until it has loaded, rather than resolving at once, so it does not settle where clerk-js never loads, such as on the server without a headless Clerk instance, or when the clerk-js script fails to load. If a headless Clerk instance fails to load while a call is waiting, that call rejects.

`handleRedirectCallback()` calls made while one is still running share it, so clerk-js handles the callback once. `<AuthenticateWithRedirectCallback />` catches the rejection itself, as upstream's does.
