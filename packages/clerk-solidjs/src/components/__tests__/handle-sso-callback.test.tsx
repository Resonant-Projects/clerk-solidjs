import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider, HandleSSOCallback } from '../..';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

/** A Core 3 resource whose finalize() calls its navigate, as clerk-js's does. */
const resource = (fields: Record<string, unknown> = {}) => {
  const self: Record<string, any> = {
    status: 'needs_identifier',
    isTransferable: false,
    supportedFirstFactors: [],
    existingSession: undefined,
    protectCheck: null,
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

const setup = (signIn: object, signUp: object, protect?: () => unknown) => {
  const { clerkJS } = createFakeClerkJS();
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

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('HandleSSOCallback', () => {
  it('finalizes a completed sign-in, once, and renders the CAPTCHA element', async () => {
    const signIn = resource({ status: 'complete' });
    const { container, props, members } = setup(signIn, resource());

    expect(container.querySelector('#clerk-captcha')).not.toBeNull();
    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    expect(members.__internal_resolvePendingProtectCheck).toHaveBeenCalledWith(
      undefined
    );
    expect(signIn.finalize).toHaveBeenCalledOnce();
    expect(props.navigateToApp).toHaveBeenCalledWith(
      expect.objectContaining({ session: { id: 'sess_1' } })
    );
  });

  it('turns a sign-up for an existing account into a sign-in', async () => {
    const signIn = resource();
    signIn.create = vi.fn(async () => {
      signIn.status = 'complete';
      return { error: null };
    });
    const { props } = setup(signIn, resource({ isTransferable: true }));

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    expect(signIn.create).toHaveBeenCalledWith({ transfer: true });
    expect(signIn.finalize).toHaveBeenCalledOnce();
  });

  it('turns a sign-in with an unknown external account into a sign-up', async () => {
    const signUp = resource({ status: 'missing_requirements' });
    signUp.create = vi.fn(async () => {
      signUp.status = 'complete';
      return { error: null };
    });
    const { props } = setup(
      resource({ status: 'needs_identifier', isTransferable: true }),
      signUp
    );

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(signUp.finalize).toHaveBeenCalledOnce();
  });

  it('hands a sign-in that needs a second factor to the sign-in page', async () => {
    const { props } = setup(
      resource({ status: 'needs_second_factor' }),
      resource({ status: 'missing_requirements' })
    );

    await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
    expect(props.navigateToApp).not.toHaveBeenCalled();
  });

  it('activates an existing session the external account already has', async () => {
    const { props, members } = setup(
      resource({
        status: 'needs_identifier',
        existingSession: { sessionId: 'sess_existing' }
      }),
      resource({ status: 'missing_requirements' })
    );

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    expect(members.setActive).toHaveBeenCalledWith(
      expect.objectContaining({ session: 'sess_existing' })
    );
  });

  it('sends a failed bot-protection check back to the flow it came from', async () => {
    window.history.replaceState(null, '', '/sso-callback?intent=signUp');
    const { props, members } = setup(resource(), resource(), () => {
      throw new Error('protect check failed');
    });

    await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
    expect(members.__internal_resolvePendingProtectCheck).toHaveBeenCalledWith(
      'signUp'
    );
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
  });
});
