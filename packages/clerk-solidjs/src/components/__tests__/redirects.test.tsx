import { cleanup, render } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const deprecations = vi.hoisted(() => ({ deprecated: vi.fn() }));
vi.mock('@clerk/shared/deprecated', () => deprecations);

import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  RedirectToCreateOrganization,
  RedirectToOrganizationProfile,
  RedirectToSignIn,
  RedirectToSignUp,
  RedirectToUserProfile
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

// clerk-js reads its options synchronously, which is what used to make a
// tracking effect redirect again when a prop changed.
const readsOptions = () =>
  vi.fn(async (options?: object) => {
    JSON.stringify(options);
  });

const createClerkJS = () => {
  const { clerkJS, emit } = createFakeClerkJS();
  const redirects = {
    redirectToSignIn: readsOptions(),
    redirectToSignUp: readsOptions(),
    redirectToAfterSignOut: vi.fn(),
    redirectToUserProfile: vi.fn(async () => {}),
    redirectToOrganizationProfile: vi.fn(async () => {}),
    redirectToCreateOrganization: vi.fn(async () => {}),
    handleRedirectCallback: readsOptions()
  };
  return { clerkJS: Object.assign(clerkJS, redirects), emit };
};

const renderInProvider = (clerkJS: unknown, ui: () => JSX.Element) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

afterEach(() => {
  cleanup();
  deprecations.deprecated.mockClear();
});

describe('redirect components', () => {
  it('redirect once, with a plain copy of their props, and not again when a prop changes', async () => {
    const { clerkJS } = createClerkJS();
    const [url, setUrl] = createSignal('/first');
    renderInProvider(clerkJS, () => (
      <>
        <RedirectToSignIn signInFallbackRedirectUrl={url()} />
        <RedirectToSignUp signUpFallbackRedirectUrl={url()} />
        <AuthenticateWithRedirectCallback signInUrl={url()} />
      </>
    ));

    await vi.waitFor(() =>
      expect(clerkJS.redirectToSignIn).toHaveBeenCalledOnce()
    );
    expect(clerkJS.redirectToSignIn).toHaveBeenCalledWith({
      signInFallbackRedirectUrl: '/first'
    });
    expect(clerkJS.redirectToSignUp).toHaveBeenCalledWith({
      signUpFallbackRedirectUrl: '/first'
    });
    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledWith({
      signInUrl: '/first'
    });

    setUrl('/second');
    await Promise.resolve();
    expect(clerkJS.redirectToSignIn).toHaveBeenCalledOnce();
    expect(clerkJS.redirectToSignUp).toHaveBeenCalledOnce();
    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledOnce();
  });

  it('do not redirect again when clerk-js emits new resources', async () => {
    const { clerkJS, emit } = createClerkJS();
    renderInProvider(clerkJS, () => <RedirectToSignIn />);

    await vi.waitFor(() =>
      expect(clerkJS.redirectToSignIn).toHaveBeenCalledOnce()
    );
    emit({ client: { sessions: [], signedInSessions: [] } as any });
    await Promise.resolve();
    expect(clerkJS.redirectToSignIn).toHaveBeenCalledOnce();
  });

  it('send RedirectToSignIn to the after-sign-out URL when other sessions are signed in', async () => {
    const { clerkJS } = createFakeClerkJS({
      client: {
        sessions: [{ id: 'sess_2' }],
        signedInSessions: [{ id: 'sess_2' }]
      } as any
    });
    const redirectToAfterSignOut = vi.fn();
    const redirectToSignIn = vi.fn();
    Object.assign(clerkJS, { redirectToAfterSignOut, redirectToSignIn });
    renderInProvider(clerkJS, () => <RedirectToSignIn />);

    await vi.waitFor(() => expect(redirectToAfterSignOut).toHaveBeenCalled());
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it('warn that the profile and organization redirects are deprecated', async () => {
    const { clerkJS } = createClerkJS();
    renderInProvider(clerkJS, () => (
      <>
        <RedirectToUserProfile />
        <RedirectToOrganizationProfile />
        <RedirectToCreateOrganization />
      </>
    ));

    await vi.waitFor(() =>
      expect(clerkJS.redirectToCreateOrganization).toHaveBeenCalledOnce()
    );
    expect(clerkJS.redirectToUserProfile).toHaveBeenCalledOnce();
    expect(clerkJS.redirectToOrganizationProfile).toHaveBeenCalledOnce();
    expect(
      deprecations.deprecated.mock.calls.map((call) => call[0]).sort()
    ).toEqual([
      'RedirectToCreateOrganization',
      'RedirectToOrganizationProfile',
      'RedirectToUserProfile'
    ]);
  });
});
