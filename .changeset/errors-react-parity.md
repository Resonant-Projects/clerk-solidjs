---
'@resonant-projects/clerk-solidjs': patch
---

`@resonant-projects/clerk-solidjs/errors` now exports everything `@clerk/react/errors` does. Six exports were missing: `ClerkAPIResponseError`, `ClerkOfflineError`, `ClerkRuntimeError`, `EmailLinkErrorCodeStatus`, `isClerkRuntimeError` and `isReverificationCancelledError`. Each is re-exported from `@clerk/shared/error`, so `instanceof` checks and the type guards behave as they do in `@clerk/react`:

```ts
import {
  ClerkOfflineError,
  isReverificationCancelledError
} from '@resonant-projects/clerk-solidjs/errors';
```
