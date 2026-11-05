import { describe, expect, it, vi } from 'vitest';
import { IsomorphicClerk } from '../isomorphic-clerk';

describe('IsomorphicClerk signOut', () => {
  it('hands callbacks and options to clerk-js unchanged, before and after it loads', async () => {
    const clerkJS = {
      loaded: false,
      load: vi.fn(async () => {
        clerkJS.loaded = true;
      }),
      addListener: vi.fn(),
      signOut: vi.fn(async () => undefined)
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    // clerk-js reads this key for its satellite sign-out repair, so the wrapper
    // must not filter options down to the keys it knows.
    const onSignOut = vi.fn();
    const options = {
      redirectUrl: '/signed-out',
      __internal_satelliteSignOutRedirectUrl: 'https://satellite.test/done'
    };

    void isomorphicClerk.signOut(onSignOut, options);
    expect(clerkJS.signOut).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));
    expect(clerkJS.signOut).toHaveBeenLastCalledWith(onSignOut, options);

    await isomorphicClerk.signOut(onSignOut, options);
    expect(clerkJS.signOut).toHaveBeenCalledTimes(2);
    expect(clerkJS.signOut).toHaveBeenLastCalledWith(onSignOut, options);
  });
});
