import { render } from '@solidjs/testing-library';
import { onTestFinished, vi } from 'vitest';
import { ClerkProvider, HandleSSOCallback } from '../..';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

/** A Core 3 resource whose finalize() calls its navigate, as clerk-js's does. */
export const resource = (fields: Record<string, unknown> = {}) => {
  const self: Record<string, any> = {
    status: 'needs_identifier',
    isTransferable: false,
    supportedFirstFactors: [],
    existingSession: undefined,
    protectCheck: null,
    // A sign-up's external account; its status is set once SSO has run.
    verifications: { externalAccount: { status: null } },
    create: vi.fn(async () => ({ error: null })),
    finalize: vi.fn(
      async ({ navigate }: { navigate: (params: unknown) => unknown }) => {
        await navigate({ session: { id: 'sess_1' }, decorateUrl: String });
        return { error: null };
      }
    ),
    ...fields
  };
  return self;
};

export const setup = (
  signIn: object,
  signUp: object,
  protect?: () => unknown,
  sessionIds: string[] = [],
  signedInIds: string[] = sessionIds
) => {
  const client = {
    sessions: sessionIds.map((id) => ({ id })),
    signedInSessions: signedInIds.map((id) => ({ id }))
  };
  const { clerkJS } = createFakeClerkJS({ client: client as any });
  const signals = createFakeState({ signIn, signUp });
  const members = {
    __internal_state: signals.state,
    __internal_resolvePendingProtectCheck: vi.fn(async () => protect?.()),
    setActive: vi.fn(
      async ({ navigate }: { navigate: (params: unknown) => unknown }) => {
        await navigate({ session: { id: 'sess_existing' } });
      }
    )
  };
  Object.assign(clerkJS, members);
  const props = {
    navigateToApp: vi.fn(),
    navigateToSignIn: vi.fn(),
    navigateToSignUp: vi.fn()
  };
  const result = render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      <HandleSSOCallback {...props} />
    </ClerkProvider>
  ));
  return { ...result, props, members };
};

// clerk-js 6.42.3 rejects setActive() with a network error, and finalize()
// returns it as `{ error }`, when it cannot confirm a new session.
export const networkError = Object.assign(new Error('Network error'), {
  code: 'network_error'
});

/** Collects unhandled rejections and console errors while a test runs. */
export const watchFailures = () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  onTestFinished(() => {
    process.off('unhandledRejection', onUnhandled);
    consoleError.mockRestore();
  });
  // Lets a rejection that nothing handles reach the process.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  return { unhandled, consoleError, settle };
};
