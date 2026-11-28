import { cleanup } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resource, setup } from './handle-sso-callback.fixtures';

/** An SSO sign-up that came back from the provider still needing a step. */
const ssoSignUp = (externalAccountStatus: string, fields = {}) =>
  resource({
    id: 'sua_123',
    status: 'missing_requirements',
    verifications: { externalAccount: { status: externalAccountStatus } },
    ...fields
  });

/** Waits for the callback to run, then lets each of its steps settle. */
const settle = async (members: {
  __internal_resolvePendingProtectCheck: any;
}) => {
  await vi.waitFor(() =>
    expect(members.__internal_resolvePendingProtectCheck).toHaveBeenCalled()
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

// As in @clerk/react 6.19.5: an SSO sign-up that needs another step, such
// as a legal acceptance or a username, continues on the sign-up page. A
// sign-up that never went through SSO, no sign-up at all, or a callback
// marked `?intent=signIn` does not.
describe('HandleSSOCallback with a sign-up that needs another step', () => {
  it('continues a verified SSO sign-up on the sign-up page', async () => {
    const signIn = resource();
    const signUp = ssoSignUp('verified');
    const { props } = setup(signIn, signUp);

    await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
    expect(props.navigateToSignUp).toHaveBeenCalledOnce();
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
    expect(props.navigateToApp).not.toHaveBeenCalled();
    expect(signIn.create).not.toHaveBeenCalled();
    expect(signUp.create).not.toHaveBeenCalled();
  });

  it('continues a sign-up that failed at the SSO provider on the sign-up page', async () => {
    const { props } = setup(resource(), ssoSignUp('failed'));

    await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
    expect(props.navigateToApp).not.toHaveBeenCalled();
  });

  it('waits for the bot-protection check before continuing the sign-up', async () => {
    let pass = () => {};
    const gate = new Promise<void>((resolve) => (pass = resolve));
    const { props, members } = setup(
      resource(),
      ssoSignUp('verified'),
      () => gate
    );

    await settle(members);
    expect(props.navigateToSignUp).not.toHaveBeenCalled();

    pass();
    await vi.waitFor(() => expect(props.navigateToSignUp).toHaveBeenCalled());
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
  });

  it('activates an existing session before continuing the sign-up', async () => {
    const { props, members } = setup(
      resource(),
      ssoSignUp('verified', {
        existingSession: { sessionId: 'sess_existing' }
      }),
      undefined,
      ['sess_existing']
    );

    await vi.waitFor(() => expect(props.navigateToApp).toHaveBeenCalled());
    expect(members.setActive).toHaveBeenCalledWith({
      session: 'sess_existing',
      navigate: expect.any(Function)
    });
    expect(props.navigateToSignUp).not.toHaveBeenCalled();
  });

  it('stays put when no sign-up was started', async () => {
    // SignUpFuture reports `missing_requirements` when there is no sign-up.
    const { props, members } = setup(
      resource({
        status: 'needs_first_factor',
        supportedFirstFactors: [{ strategy: 'enterprise_sso' }]
      }),
      resource({
        status: 'missing_requirements',
        verifications: { externalAccount: { status: 'verified' } }
      })
    );

    await settle(members);
    expect(props.navigateToSignUp).not.toHaveBeenCalled();
    expect(props.navigateToSignIn).not.toHaveBeenCalled();
  });

  it('leaves an unfinished sign-up that never used SSO alone', async () => {
    // Starting a sign-in does not clear an earlier password sign-up.
    const { props, members } = setup(
      resource({ status: 'needs_client_trust' }),
      resource({ id: 'sua_stale', status: 'missing_requirements' })
    );

    await settle(members);
    expect(props.navigateToSignUp).not.toHaveBeenCalled();
  });

  it('leaves an abandoned sign-up alone', async () => {
    const { props, members } = setup(
      resource(),
      ssoSignUp('verified', { status: 'abandoned' })
    );

    await settle(members);
    expect(props.navigateToSignUp).not.toHaveBeenCalled();
  });

  it('does not continue a sign-up from a callback marked for sign-in', async () => {
    window.history.replaceState(null, '', '/sso-callback?intent=signIn');
    const { props, members } = setup(
      resource({
        status: 'needs_first_factor',
        supportedFirstFactors: [{ strategy: 'enterprise_sso' }]
      }),
      ssoSignUp('verified', { id: 'sua_stale' })
    );

    await settle(members);
    expect(members.__internal_resolvePendingProtectCheck).toHaveBeenCalledWith(
      'signIn'
    );
    expect(props.navigateToSignUp).not.toHaveBeenCalled();
  });
});
