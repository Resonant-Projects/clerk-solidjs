import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

const deprecations = vi.hoisted(() => ({ deprecated: vi.fn() }));
vi.mock('@clerk/shared/deprecated', () => deprecations);

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

  it('maps the Core 2 afterSignInUrl and afterSignUpUrl to the fallback redirect URLs, with a warning', async () => {
    const options = await loadOptions({
      publishableKey: TEST_PUBLISHABLE_KEY,
      afterSignInUrl: '/after-sign-in',
      afterSignUpUrl: '/after-sign-up'
    });

    expect(options.signInFallbackRedirectUrl).toBe('/after-sign-in');
    expect(options.signUpFallbackRedirectUrl).toBe('/after-sign-up');
    expect(deprecations.deprecated.mock.calls.map((call) => call[0])).toEqual([
      'afterSignInUrl',
      'afterSignUpUrl'
    ]);
  });

  it('keeps explicit fallback redirect URLs over the legacy props', async () => {
    const options = await loadOptions({
      publishableKey: TEST_PUBLISHABLE_KEY,
      afterSignInUrl: '/legacy',
      signInFallbackRedirectUrl: '/explicit'
    });

    expect(options.signInFallbackRedirectUrl).toBe('/explicit');
  });

  it('does not warn without the legacy props', async () => {
    await loadOptions({ publishableKey: TEST_PUBLISHABLE_KEY });

    expect(deprecations.deprecated).not.toHaveBeenCalled();
  });
});
