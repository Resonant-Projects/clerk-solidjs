// Types `event.locals.auth` as the session auth object clerkMiddleware()
// sets. Opt in from a .d.ts file in your app, such as src/global.d.ts:
//
//   /// <reference types="@resonant-projects/clerk-solidjs/start/env" />
//
// Leave it out if your app declares its own `auth` on App.RequestEventLocals.
import type { SessionAuthObjectWithRedirect } from './dist/start/server/index.js';

declare global {
  namespace App {
    interface RequestEventLocals {
      /** The request's session auth object, set by clerkMiddleware(). */
      auth: SessionAuthObjectWithRedirect;
    }
  }
}

export {};
