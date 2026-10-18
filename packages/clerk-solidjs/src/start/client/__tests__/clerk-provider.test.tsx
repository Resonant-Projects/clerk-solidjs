import type { SDKMetadata } from '@clerk/shared/types';
import { Router } from '@solidjs/router';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider } from '..';
import { createFakeClerkJS } from '../../../__tests__/helpers/fake-clerk-js';
import { SignedIn, SignedOut } from '../../../components';
import { signedInInitState } from './fixtures';

afterEach(() => {
  cleanup();
  delete window.__clerk_init_state;
  vi.unstubAllEnvs();
});

const loadOptions = async (ui?: {
  sdkMetadata?: SDKMetadata;
  telemetry?: { debug?: boolean; disabled?: boolean };
}) => {
  const { clerkJS } = createFakeClerkJS();
  render(() => (
    <Router
      root={() => (
        <ClerkProvider Clerk={clerkJS as any} {...ui}>
          <p>app</p>
        </ClerkProvider>
      )}
    />
  ));
  await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
  return clerkJS.load.mock.calls[0]![0] as Record<string, any>;
};

/** A clerk-js that never finishes loading, so only the server state counts. */
const neverLoadingClerk = () => {
  const { clerkJS } = createFakeClerkJS();
  clerkJS.load.mockImplementation(() => new Promise<void>(() => {}));
  return clerkJS;
};

const renderApp = () =>
  render(() => (
    <Router
      root={() => (
        <ClerkProvider Clerk={neverLoadingClerk() as any}>
          <SignedIn>
            <p>signed-in</p>
          </SignedIn>
          <SignedOut>
            <p>signed-out</p>
          </SignedOut>
        </ClerkProvider>
      )}
    />
  ));

describe('SolidStart ClerkProvider in the browser', () => {
  it('renders the server auth state before clerk-js loads', () => {
    window.__clerk_init_state = signedInInitState();

    renderApp();

    // Synchronous: no waiting for clerk-js, so hydration matches the server.
    expect(screen.getByText('signed-in')).toBeTruthy();
    expect(screen.queryByText('signed-out')).toBeNull();
  });

  it('takes the publishable key from the server state', async () => {
    const { clerkJS } = createFakeClerkJS();
    window.__clerk_init_state = signedInInitState();

    render(() => (
      <Router
        root={() => (
          <ClerkProvider Clerk={clerkJS as any}>
            <p>app</p>
          </ClerkProvider>
        )}
      />
    ));

    await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
    expect(clerkJS.load.mock.calls[0]![0]).toMatchObject({
      publishableKey:
        signedInInitState().__internal_clerk_state.__publishableKey,
      signInUrl: '/sign-in'
    });
  });

  it('identifies itself to clerk-js as the SolidStart SDK', async () => {
    window.__clerk_init_state = signedInInitState();

    expect((await loadOptions()).sdkMetadata).toEqual({
      name: `${PACKAGE_NAME}/start`,
      version: PACKAGE_VERSION,
      environment: process.env.NODE_ENV
    });
  });

  it('passes on SDK metadata the app provides', async () => {
    window.__clerk_init_state = signedInInitState();
    const sdkMetadata = { name: 'my-sdk', version: '1.0.0' };

    expect((await loadOptions({ sdkMetadata })).sdkMetadata).toEqual(
      sdkMetadata
    );
  });

  it('falls back to the env proxy URL and telemetry settings', async () => {
    window.__clerk_init_state = signedInInitState();
    vi.stubEnv('VITE_CLERK_PROXY_URL', 'https://example.com/__clerk');
    vi.stubEnv('VITE_CLERK_TELEMETRY_DISABLED', 'true');
    vi.stubEnv('VITE_CLERK_TELEMETRY_DEBUG', 'true');

    expect(await loadOptions()).toMatchObject({
      proxyUrl: 'https://example.com/__clerk',
      telemetry: { disabled: true, debug: true }
    });
  });

  it('keeps an env telemetry opt-out when the app passes other telemetry options', async () => {
    window.__clerk_init_state = signedInInitState();
    vi.stubEnv('VITE_CLERK_TELEMETRY_DISABLED', 'true');

    expect(
      (await loadOptions({ telemetry: { debug: true } })).telemetry
    ).toEqual({ disabled: true, debug: true });
  });

  it('takes the checkout continue URL from the server state', async () => {
    window.__clerk_init_state = signedInInitState({
      __newSubscriptionRedirectUrl: '/billing/done'
    });

    expect((await loadOptions()).newSubscriptionRedirectUrl).toBe(
      '/billing/done'
    );
  });

  it('prefers the server state over the env', async () => {
    window.__clerk_init_state = signedInInitState({
      __proxyUrl: 'https://server.example.com/__clerk'
    });
    vi.stubEnv('VITE_CLERK_PROXY_URL', 'https://example.com/__clerk');

    expect((await loadOptions()).proxyUrl).toBe(
      'https://server.example.com/__clerk'
    );
  });
});
