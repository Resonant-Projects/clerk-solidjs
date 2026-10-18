import { inBrowser } from '@clerk/shared/browser';
import { ClerkRuntimeError } from '@clerk/shared/error';
import type { ClerkStatus } from '@clerk/shared/types';
import { Accessor } from 'solid-js';
import type { IsomorphicClerk } from '../isomorphic-clerk';

/**
 * Resolves once Clerk is usable: status `ready`, or `degraded` when some of
 * it failed to load.
 *
 * @internal
 */
const clerkLoaded = (isomorphicClerk: IsomorphicClerk) => {
  return new Promise<void>((resolve) => {
    const handler = (status: ClerkStatus) => {
      if (status === 'ready' || status === 'degraded') {
        resolve();
        // Unsubscribe after this dispatch: the event bus walks its live
        // handler list, so removing a handler now would skip the next one.
        queueMicrotask(() => isomorphicClerk.off('status', handler));
      }
    };
    isomorphicClerk.on('status', handler, { notify: true });
  });
};

/**
 * @internal
 */
export const createGetToken = (isomorphicClerk: Accessor<IsomorphicClerk>) => {
  return async (options: any) => {
    if (!inBrowser()) {
      throw new ClerkRuntimeError(
        'useAuth().getToken() can only be used in browser environments. To access auth data server-side, see the Auth object reference doc: https://clerk.com/docs/reference/backend/types/auth-object',
        { code: 'clerk_runtime_not_browser' }
      );
    }

    const clerk = isomorphicClerk();
    await clerkLoaded(clerk);
    if (!clerk.session) {
      return null;
    }
    return clerk.session.getToken(options);
  };
};

/**
 * @internal
 */
export const createSignOut = (isomorphicClerk: Accessor<IsomorphicClerk>) => {
  return async (...args: any) => {
    const clerk = isomorphicClerk();
    await clerkLoaded(clerk);
    return clerk.signOut(...args);
  };
};
