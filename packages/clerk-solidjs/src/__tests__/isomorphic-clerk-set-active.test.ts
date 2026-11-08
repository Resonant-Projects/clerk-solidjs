import { describe, expect, it, vi } from 'vitest';
import { IsomorphicClerk } from '../isomorphic-clerk';

const loadedClerk = async (setActive: (params: unknown) => Promise<void>) => {
  const clerkJS = {
    loaded: false,
    load: vi.fn(async () => {
      clerkJS.loaded = true;
    }),
    addListener: vi.fn(),
    setActive: vi.fn(setActive),
    signOut: vi.fn(async () => undefined)
  };
  const isomorphicClerk = new IsomorphicClerk({
    publishableKey: 'pk_test_XXX',
    Clerk: clerkJS as any
  });
  await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));
  return { clerkJS, isomorphicClerk };
};

describe('IsomorphicClerk setActive', () => {
  it('hands params to clerk-js unchanged', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk(
      async () => undefined
    );
    const navigate = vi.fn();
    const params = { session: 'sess_123', navigate };

    await isomorphicClerk.setActive(params);

    expect(clerkJS.setActive).toHaveBeenCalledExactlyOnceWith(params);
  });

  // clerk-js 6.42.3 rejects with a network error when it cannot confirm a new
  // session, instead of signing the user out. The wrapper must pass that
  // rejection on so callers can retry; swallowing it would leave them
  // thinking the session is active.
  it('passes on a clerk-js rejection without signing out', async () => {
    const networkError = Object.assign(new Error('Network error'), {
      code: 'network_error'
    });
    const { clerkJS, isomorphicClerk } = await loadedClerk(async () => {
      throw networkError;
    });

    await expect(
      isomorphicClerk.setActive({ session: 'sess_123' })
    ).rejects.toBe(networkError);
    expect(clerkJS.signOut).not.toHaveBeenCalled();
  });

  it('rejects before clerk-js exists', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX'
    });

    await expect(
      isomorphicClerk.setActive({ session: 'sess_123' })
    ).rejects.toBeUndefined();
  });
});
