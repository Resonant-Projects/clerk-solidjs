import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/shared/loadClerkJsScript', () => ({
  loadClerkJSScript: vi.fn(),
  loadClerkUIScript: vi.fn(),
  setClerkJSLoadingErrorPackageName: vi.fn()
}));

import { IsomorphicClerk } from '../isomorphic-clerk';

const createClerkJS = (signIn: Record<string, unknown>) => {
  const clerkJS = {
    loaded: false,
    load: vi.fn(async () => {
      clerkJS.loaded = true;
    }),
    addListener: vi.fn(),
    __internal_state: { signInSignal: () => ({ signIn }) }
  };
  return clerkJS;
};

describe('the sign-in signal stand-in', () => {
  // Port of @clerk/react 6.19.0's `clientTrustState` getter on the stand-in.
  it('has clientTrustState, undefined before clerk-js loads and read from clerk-js after', async () => {
    const clerkJS = createClerkJS({ clientTrustState: 'known' });
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    // The value useSignIn() hands out before load, and keeps for its readers.
    const signIn = isomorphicClerk.__internal_state.signInSignal().signIn!;

    expect('clientTrustState' in signIn).toBe(true);
    expect(signIn.clientTrustState).toBeUndefined();

    await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));

    expect(signIn.clientTrustState).toBe('known');
  });
});
