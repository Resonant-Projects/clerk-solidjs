import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
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

const setup = (
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
const networkError = Object.assign(new Error('Network error'), {
  code: 'network_error'
});

/** Collects unhandled rejections and console errors while a test runs. */
const watchFailures = () => {
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

  it("waits for the app's navigation before an existing session finishes activating", async () => {
    let finishNavigation!: () => void;
    let activated = false;
    const { props, members } = setup(
      resource({
        status: 'needs_identifier',
        existingSession: { sessionId: 'sess_existing' }
      }),
      resource({ status: 'missing_requirements' })
    );
    props.navigateToApp.mockImplementation(
      () => new Promise<void>((resolve) => (finishNavigation = resolve))
    );
    // As clerk-js does: publish the session only after navigate settles.
    members.setActive.mockImplementation(async ({ navigate }) => {
      await navigate({ session: { id: 'sess_existing' } });
      activated = true;
    });

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(activated).toBe(false);

    finishNavigation();
    await vi.waitFor(() => expect(activated).toBe(true));
  });

  it("waits for the app's navigation before a finalized sign-in is published", async () => {
    let finishNavigation!: () => void;
    let published = false;
    const signIn = resource({ status: 'complete' });
    signIn.finalize = vi.fn(async ({ navigate }) => {
      await navigate({ session: { id: 'sess_1' }, decorateUrl: String });
      published = true;
      return { error: null };
    });
    const { props } = setup(signIn, resource());
    props.navigateToApp.mockImplementation(
      () => new Promise<void>((resolve) => (finishNavigation = resolve))
    );

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(published).toBe(false);

    finishNavigation();
    await vi.waitFor(() => expect(published).toBe(true));
  });

  it('continues an SSO sign-up that still needs fields on the sign-up page', async () => {
    const { props } = setup(
      resource({ status: 'needs_identifier' }),
      resource({ status: 'missing_requirements' })
    );

    await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
    expect(props.navigateToApp).not.toHaveBeenCalled();
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

  describe('when a step fails', () => {
    it('sends a sign-in whose finalize() fails back to the sign-in page', async () => {
      const failures = watchFailures();
      const signIn = resource({
        status: 'complete',
        finalize: vi.fn(async () => ({ error: networkError }))
      });
      const { props } = setup(signIn, resource());

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToSignIn).toHaveBeenCalledOnce();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
      expect(failures.consoleError).toHaveBeenCalledWith(
        'Clerk: HandleSSOCallback could not finish the signIn flow: finalize failed (network_error).'
      );
    });

    it('sends a sign-up whose finalize() fails back to the sign-up page', async () => {
      const failures = watchFailures();
      const signUp = resource({
        status: 'complete',
        finalize: vi.fn(async () => ({ error: networkError }))
      });
      const { props } = setup(resource(), signUp);

      await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignIn).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    it('sends a transferred sign-up whose finalize() fails back to the sign-up page', async () => {
      const failures = watchFailures();
      const signUp = resource({
        finalize: vi.fn(async () => ({ error: networkError }))
      });
      signUp.create = vi.fn(async () => {
        signUp.status = 'complete';
        return { error: null };
      });
      const { props } = setup(resource({ isTransferable: true }), signUp);

      await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
      await failures.settle();
      expect(signUp.finalize).toHaveBeenCalledOnce();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    it('sends a failed activation of an existing session back to the sign-in page', async () => {
      const failures = watchFailures();
      const { props, members } = setup(
        resource({ existingSession: { sessionId: 'sess_existing' } }),
        resource({ status: 'missing_requirements' })
      );
      members.setActive.mockRejectedValue(networkError);

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(members.setActive).toHaveBeenCalledOnce();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
      expect(failures.consoleError).toHaveBeenCalledWith(
        'Clerk: HandleSSOCallback could not finish the signIn flow: activate failed (network_error).'
      );
    });

    it("sends a failed activation of a sign-up's existing session back to the sign-up page", async () => {
      const failures = watchFailures();
      const { props, members } = setup(
        resource(),
        resource({ existingSession: { sessionId: 'sess_existing' } })
      );
      members.setActive.mockRejectedValue(networkError);

      await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignIn).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    it('sends a step that throws back to the flow of that step', async () => {
      const failures = watchFailures();
      // As clerk-js's finalize() does when there is no created session. No
      // intent in the URL: the failed step decides the page.
      const missingSession = new Error(
        'Cannot finalize sign-up without a created session.'
      );
      const signUp = resource({
        status: 'complete',
        finalize: vi.fn(() => {
          throw missingSession;
        })
      });
      const { props } = setup(resource(), signUp);

      await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToSignIn).not.toHaveBeenCalled();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
      expect(failures.consoleError).toHaveBeenCalledWith(
        'Clerk: HandleSSOCallback could not finish the signUp flow: unexpected failed.'
      );
    });

    it("calls an app's navigation that throws once, without an unhandled rejection", async () => {
      const failures = watchFailures();
      const navigationError = new Error('router not ready');
      const { props } = setup(
        resource({ status: 'needs_second_factor' }),
        resource({ status: 'missing_requirements' })
      );
      props.navigateToSignIn.mockImplementation(() => {
        throw navigationError;
      });

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToSignIn).toHaveBeenCalledOnce();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
      expect(failures.consoleError).toHaveBeenCalledWith(
        'Clerk: HandleSSOCallback could not finish the signIn flow: navigation failed.'
      );
    });

    it("leaves the route to the app once the app's navigation has started", async () => {
      const failures = watchFailures();
      const signIn = resource({ status: 'complete' });
      signIn.finalize = vi.fn(async ({ navigate }) => {
        await navigate({ session: { id: 'sess_1' }, decorateUrl: String });
        return { error: networkError };
      });
      const { props } = setup(signIn, resource());

      await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToSignIn).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    // clerk-js's setActive() signs out, with no error and no navigation, when
    // its client does not list the session even after a reload.
    const signedOutFinalize = () =>
      resource({
        status: 'complete',
        createdSessionId: 'sess_new',
        finalize: vi.fn(async () => ({ error: null }))
      });

    it('sends a sign-in that clerk-js signed out instead of activating back to the sign-in page', async () => {
      const failures = watchFailures();
      const { props } = setup(signedOutFinalize(), resource());

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
      expect(failures.consoleError).toHaveBeenCalledWith(
        'Clerk: HandleSSOCallback could not finish the signIn flow: not_activated failed.'
      );
    });

    it('leaves a session clerk-js activated without our navigation alone', async () => {
      // A session with a task URL: clerk-js navigates to it itself.
      const failures = watchFailures();
      const signIn = signedOutFinalize();
      const { props } = setup(signIn, resource(), undefined, ['sess_new']);

      await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToSignIn).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(failures.consoleError).not.toHaveBeenCalled();
    });

    it('sends a sign-in whose session ended instead of activating back to the sign-in page', async () => {
      const failures = watchFailures();
      // On the client, but not signed in: clerk-js signs out.
      const { props } = setup(
        signedOutFinalize(),
        resource(),
        undefined,
        ['sess_new'],
        []
      );

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    it('sends an existing session clerk-js signed out instead of activating back to the sign-in page', async () => {
      const failures = watchFailures();
      const { props, members } = setup(
        resource({ existingSession: { sessionId: 'sess_existing' } }),
        resource({ status: 'missing_requirements' })
      );
      members.setActive.mockResolvedValue(undefined);

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(props.navigateToApp).not.toHaveBeenCalled();
      expect(props.navigateToSignUp).not.toHaveBeenCalled();
      expect(failures.unhandled).toEqual([]);
    });

    it('logs only a fixed diagnostic, never what a thrown value carries', async () => {
      // Synthetic markers stand in for a token, a private URL and user data.
      const marker = 'SYNTHETIC-PRIVATE-MARKER';
      const thrown = Object.assign(
        new Error(`fetch https://fapi.example.test/?__clerk_db_jwt=${marker}`),
        { code: `bad code ${marker}`, url: `https://example.test/${marker}` }
      );
      const failures = watchFailures();
      const { props, members } = setup(
        resource({ existingSession: { sessionId: `sess_${marker}` } }),
        resource({ status: 'missing_requirements' })
      );
      members.setActive.mockRejectedValue(thrown);
      props.navigateToSignIn.mockImplementation(() => {
        throw new Error(`router state ${marker}`);
      });

      await vi.waitFor(() => expect(props.navigateToSignIn).toHaveBeenCalled());
      await failures.settle();
      expect(failures.unhandled).toEqual([]);
      const logged = failures.consoleError.mock.calls;
      expect(logged).toEqual([
        [
          'Clerk: HandleSSOCallback could not finish the signIn flow: activate failed.'
        ],
        [
          'Clerk: HandleSSOCallback could not finish the signIn flow: navigation failed.'
        ]
      ]);
      expect(JSON.stringify(logged)).not.toContain(marker);
    });
  });
});
