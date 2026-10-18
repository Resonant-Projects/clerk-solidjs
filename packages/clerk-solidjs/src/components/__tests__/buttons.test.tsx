import { cleanup, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  SignInButton,
  SignInWithMetamaskButton,
  SignOutButton,
  SignUpButton
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const createClerkJS = () => {
  const { clerkJS } = createFakeClerkJS();
  return Object.assign(clerkJS, {
    openSignIn: vi.fn(),
    openSignUp: vi.fn(),
    redirectToSignIn: vi.fn(async () => {}),
    redirectToSignUp: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    authenticateWithMetamask: vi.fn(async () => {})
  });
};

type ClerkJS = ReturnType<typeof createClerkJS>;

const renderInProvider = (clerkJS: ClerkJS, ui: () => JSX.Element) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

const loaded = (clerkJS: ClerkJS) =>
  vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

afterEach(() => {
  cleanup();
});

describe('Clerk buttons', () => {
  it('render a custom button child as the only button, and run both click handlers', async () => {
    const clerkJS = createClerkJS();
    const onChildClick = vi.fn();
    const { container } = renderInProvider(clerkJS, () => (
      <SignInButton>
        <button class="custom" onClick={onChildClick}>
          Log in
        </button>
      </SignInButton>
    ));
    await loaded(clerkJS);

    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelector('button')!.className).toBe('custom');

    await userEvent.click(screen.getByText('Log in'));
    expect(onChildClick).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(clerkJS.redirectToSignIn).toHaveBeenCalled());
  });

  it('wrap a text child in the default button, with its attributes', async () => {
    const clerkJS = createClerkJS();
    const onClick = vi.fn();
    const { container } = renderInProvider(clerkJS, () => (
      <SignUpButton class="cta" onClick={onClick}>
        Join
      </SignUpButton>
    ));
    await loaded(clerkJS);

    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('Join');
    expect(button.className).toBe('cta');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(clerkJS.redirectToSignUp).toHaveBeenCalled());
  });

  it('render before Clerk loads, and a click then runs once it has', async () => {
    const clerkJS = createClerkJS();
    let finishLoading!: () => void;
    clerkJS.load.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = () => {
            clerkJS.loaded = true;
            resolve();
          };
        })
    );
    renderInProvider(clerkJS, () => <SignInButton mode="modal" />);

    await userEvent.click(screen.getByText('Sign in'));
    expect(clerkJS.openSignIn).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(finishLoading).toBeTypeOf('function'));
    finishLoading();
    await vi.waitFor(() => expect(clerkJS.openSignIn).toHaveBeenCalledOnce());
  });

  it('send every SignInButton prop to Clerk', async () => {
    const clerkJS = createClerkJS();
    const appearance = { variables: { colorPrimary: 'red' } };
    renderInProvider(clerkJS, () => (
      <>
        <SignInButton
          mode="modal"
          appearance={appearance}
          fallbackRedirectUrl="/fallback"
          forceRedirectUrl="/force"
          signUpFallbackRedirectUrl="/up-fallback"
          signUpForceRedirectUrl="/up-force"
          initialValues={{ emailAddress: 'a@example.com' }}
          withSignUp
          oauthFlow="popup"
        >
          Modal
        </SignInButton>
        <SignInButton
          fallbackRedirectUrl="/fallback"
          initialValues={{ emailAddress: 'a@example.com' }}
          oauthFlow="redirect"
        >
          Redirect
        </SignInButton>
      </>
    ));
    await loaded(clerkJS);

    await userEvent.click(screen.getByText('Modal'));
    await userEvent.click(screen.getByText('Redirect'));

    expect(clerkJS.openSignIn).toHaveBeenCalledWith({
      appearance,
      fallbackRedirectUrl: '/fallback',
      forceRedirectUrl: '/force',
      signUpFallbackRedirectUrl: '/up-fallback',
      signUpForceRedirectUrl: '/up-force',
      initialValues: { emailAddress: 'a@example.com' },
      withSignUp: true,
      oauthFlow: 'popup'
    });
    expect(clerkJS.redirectToSignIn).toHaveBeenCalledWith({
      fallbackRedirectUrl: '/fallback',
      signInFallbackRedirectUrl: '/fallback',
      initialValues: { emailAddress: 'a@example.com' },
      oauthFlow: 'redirect'
    });
  });

  it('send every SignUpButton prop to Clerk, and keep them off the DOM', async () => {
    const clerkJS = createClerkJS();
    const unsafeMetadata = { plan: 'pro' };
    const { container } = renderInProvider(clerkJS, () => (
      <>
        <SignUpButton
          mode="modal"
          unsafeMetadata={unsafeMetadata}
          fallbackRedirectUrl="/fallback"
          signInFallbackRedirectUrl="/in-fallback"
          signInForceRedirectUrl="/in-force"
          initialValues={{ firstName: 'Ada' }}
          oauthFlow="popup"
        >
          Modal
        </SignUpButton>
        <SignUpButton forceRedirectUrl="/force">Redirect</SignUpButton>
      </>
    ));
    await loaded(clerkJS);

    for (const button of container.querySelectorAll('button')) {
      expect(button.getAttributeNames()).toEqual([]);
    }

    await userEvent.click(screen.getByText('Modal'));
    await userEvent.click(screen.getByText('Redirect'));

    expect(clerkJS.openSignUp).toHaveBeenCalledWith({
      unsafeMetadata,
      fallbackRedirectUrl: '/fallback',
      signInFallbackRedirectUrl: '/in-fallback',
      signInForceRedirectUrl: '/in-force',
      initialValues: { firstName: 'Ada' },
      oauthFlow: 'popup'
    });
    expect(clerkJS.redirectToSignUp).toHaveBeenCalledWith({
      forceRedirectUrl: '/force',
      signUpForceRedirectUrl: '/force'
    });
  });

  it('pass SignOutButton and SignInWithMetamaskButton options to Clerk', async () => {
    const clerkJS = createClerkJS();
    renderInProvider(clerkJS, () => (
      <>
        <SignOutButton redirectUrl="/bye" sessionId="sess_2" />
        <SignInWithMetamaskButton redirectUrl="/web3" />
      </>
    ));
    await loaded(clerkJS);

    await userEvent.click(screen.getByText('Sign out'));
    await userEvent.click(screen.getByText('Sign in with Metamask'));

    expect(clerkJS.signOut).toHaveBeenCalledWith({
      redirectUrl: '/bye',
      sessionId: 'sess_2'
    });
    expect(clerkJS.authenticateWithMetamask).toHaveBeenCalledWith({
      redirectUrl: '/web3'
    });
  });

  it('reject more than one child', () => {
    const clerkJS = createClerkJS();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() =>
      renderInProvider(clerkJS, () => (
        <SignInButton>
          <span>one</span>
          <span>two</span>
        </SignInButton>
      ))
    ).toThrow(/multiple children/);
    consoleError.mockRestore();
  });
});
