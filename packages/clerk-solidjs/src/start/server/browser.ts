/**
 * What a browser build gets for `@resonant-projects/clerk-solidjs/start/server`,
 * through its `browser` export condition. A route file may import `auth` for
 * its `"use server"` functions, so importing works, and the browser bundle
 * no longer includes `@clerk/backend`. Calling anything server-only in the
 * browser throws an error that says where to call it instead.
 *
 * Keep the names in step with `./index.ts`; a test checks them.
 */
export {
  reverificationError,
  reverificationErrorResponse
} from '@clerk/shared/authorization-errors';

const serverOnly = (name: string) => (): never => {
  throw new Error(
    `Clerk: ${name}() from ${PACKAGE_NAME}/start/server only runs on the server. Call it in a "use server" function, an API route or src/middleware.ts, not in code that runs in the browser.`
  );
};

export const auth = serverOnly('auth');
export const clerkClient = serverOnly('clerkClient');
export const clerkMiddleware = serverOnly('clerkMiddleware');
export const createClerkClient = serverOnly('createClerkClient');
export const verifyToken = serverOnly('verifyToken');
