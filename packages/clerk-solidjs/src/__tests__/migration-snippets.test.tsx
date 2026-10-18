import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { ClerkProvider, Show, SignInButton, UserButton, useSignIn } from '..';
import * as legacy from '../legacy';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from './helpers/fake-clerk-js';

// The 4.0 snippets in MIGRATION.md, so they keep type-checking.

const SignInForm = (props: {
  identifier: string;
  password: string;
  navigate: (to: string) => void;
}) => {
  const state = useSignIn();
  const { signIn, errors } = state;

  const submit = async () => {
    await signIn.password({
      identifier: props.identifier,
      password: props.password
    });
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => props.navigate('/') });
    }
  };

  return (
    <button disabled={state.fetchStatus === 'fetching'} onClick={submit}>
      {errors.fields.identifier?.message ?? 'Sign in'}
    </button>
  );
};

const AdminPanel = () => <p>admin</p>;
const Billing = () => <p>billing</p>;

const ControlComponents = () => (
  <>
    <Show when="signed-in">
      <UserButton />
    </Show>
    <Show when="signed-out">
      <SignInButton />
    </Show>
    <Show when={{ role: 'org:admin' }} fallback={<p>Admins only</p>}>
      <AdminPanel />
    </Show>
    <Show when={(has) => has({ permission: 'org:billing:manage' })}>
      <Billing />
    </Show>
  </>
);

const Provider = (props: { children?: any }) => (
  <ClerkProvider
    publishableKey={TEST_PUBLISHABLE_KEY}
    signInFallbackRedirectUrl="/dashboard"
    signUpFallbackRedirectUrl="/onboarding"
  >
    {props.children}
  </ClerkProvider>
);

afterEach(() => {
  cleanup();
});

describe('MIGRATION.md', () => {
  it('has 4.0 snippets that compile and render', async () => {
    const { clerkJS } = createFakeClerkJS();
    Object.assign(clerkJS, { __internal_state: createFakeState().state });
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <SignInForm
          identifier="a@example.com"
          password="x"
          navigate={() => {}}
        />
        <ControlComponents />
      </ClerkProvider>
    ));

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(Provider).toBeTypeOf('function');
    expect(legacy.useSignIn).toBeTypeOf('function');
    expect(legacy.useSignUp).toBeTypeOf('function');
  });
});
