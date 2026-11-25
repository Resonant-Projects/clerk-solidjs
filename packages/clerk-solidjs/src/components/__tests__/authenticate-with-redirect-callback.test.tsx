import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthenticateWithRedirectCallback, ClerkProvider } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';
import { IsomorphicClerk } from '../../isomorphic-clerk';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AuthenticateWithRedirectCallback', () => {
  // handleRedirectCallback now rejects when clerk-js does, as in
  // @clerk/react. The component has nobody to hand the error to, so it must
  // not leave the rejection unhandled.
  it('does not leave a rejected handleRedirectCallback unhandled', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    // A plain function: a vi.fn() handles the promises it returns, to record
    // how they settle, which would hide an unhandled rejection.
    const calls: unknown[][] = [];
    const handleRedirectCallback = (...args: unknown[]) => {
      calls.push(args);
      return Promise.reject(new Error('callback failed'));
    };
    const getOrCreateInstance =
      IsomorphicClerk.getOrCreateInstance.bind(IsomorphicClerk);
    vi.spyOn(IsomorphicClerk, 'getOrCreateInstance').mockImplementation(
      (options) => {
        const instance = getOrCreateInstance(options);
        instance.handleRedirectCallback = handleRedirectCallback;
        return instance;
      }
    );
    const { clerkJS } = createFakeClerkJS();

    try {
      render(() => (
        <ClerkProvider
          publishableKey={TEST_PUBLISHABLE_KEY}
          Clerk={clerkJS as any}
        >
          <AuthenticateWithRedirectCallback signInUrl="/sign-in" />
        </ClerkProvider>
      ));

      await vi.waitFor(() =>
        expect(calls).toEqual([[{ signInUrl: '/sign-in' }]])
      );
      // Node reports an unhandled rejection after the microtask queue drains.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
