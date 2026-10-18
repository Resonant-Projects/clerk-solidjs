import { cleanup, render } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import { afterEach, describe, expect, it, vi } from 'vitest';

const deprecations = vi.hoisted(() => ({ deprecated: vi.fn() }));
vi.mock('@clerk/shared/deprecated', () => deprecations);

import type { ClerkProviderProps } from '../..';
import { ClerkProvider } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  deprecations.deprecated.mockClear();
});

const loadOptions = async (
  props: Record<string, unknown>
): Promise<Record<string, any>> => {
  const { clerkJS } = createFakeClerkJS();
  render(() => (
    <ClerkProvider Clerk={clerkJS as any} {...(props as any)}>
      <p>app</p>
    </ClerkProvider>
  ));
  await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
  return clerkJS.load.mock.calls[0]![0] as Record<string, any>;
};

describe('ClerkProvider options', () => {
  it('reads the publishable key from VITE_CLERK_PUBLISHABLE_KEY when none is passed', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', TEST_PUBLISHABLE_KEY);

    expect((await loadOptions({})).publishableKey).toBe(TEST_PUBLISHABLE_KEY);
  });

  it('falls back to CLERK_PUBLISHABLE_KEY', async () => {
    vi.stubEnv('CLERK_PUBLISHABLE_KEY', TEST_PUBLISHABLE_KEY);

    expect((await loadOptions({})).publishableKey).toBe(TEST_PUBLISHABLE_KEY);
  });

  it('prefers the publishableKey prop over the env', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_from_env');

    expect(
      (await loadOptions({ publishableKey: TEST_PUBLISHABLE_KEY }))
        .publishableKey
    ).toBe(TEST_PUBLISHABLE_KEY);
  });

  it('ignores the Core 2 afterSignInUrl and afterSignUpUrl, which 4.0 removed', async () => {
    const options = await loadOptions({
      publishableKey: TEST_PUBLISHABLE_KEY,
      ...({
        afterSignInUrl: '/after-sign-in',
        afterSignUpUrl: '/after-sign-up'
      } as object)
    });

    expect(options.signInFallbackRedirectUrl).toBeUndefined();
    expect(options.signUpFallbackRedirectUrl).toBeUndefined();
    expect(deprecations.deprecated).not.toHaveBeenCalled();
    expectTypeOf<ClerkProviderProps>().not.toHaveProperty('afterSignInUrl');
    expectTypeOf<ClerkProviderProps>().not.toHaveProperty('afterSignUpUrl');
  });

  it('loads a Clerk instance passed without a publishable key', async () => {
    const { clerkJS } = createFakeClerkJS();
    render(() => (
      <ClerkProvider Clerk={clerkJS as any}>
        <p>app</p>
      </ClerkProvider>
    ));

    await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
  });
});
