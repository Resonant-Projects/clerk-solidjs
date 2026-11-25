import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, expect, it, vi } from 'vitest';
import { ClerkProvider, useSignIn } from '../..';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

/** clerk-js keeps the trust state in a private field and updates it in place. */
class FakeSignInFuture {
  #clientTrustState: 'new' | 'known' | 'pending' | undefined = 'pending';
  get status() {
    return 'needs_second_factor';
  }
  get clientTrustState() {
    return this.#clientTrustState;
  }
  trust() {
    this.#clientTrustState = 'known';
  }
}

afterEach(() => {
  cleanup();
});

// Port of @clerk/react 6.19.0's `clientTrustState` on the sign-in stand-in.
it("useSignIn() reads clientTrustState as undefined before Clerk loads, then follows clerk-js's sign-in", async () => {
  const future = new FakeSignInFuture();
  const fake = createFakeClerkJS();
  const signals = createFakeState({ signIn: future });
  let finishLoading!: () => void;
  const loading = new Promise<void>((resolve) => (finishLoading = resolve));
  fake.clerkJS.load.mockImplementation(async () => {
    await loading;
    fake.clerkJS.loaded = true;
  });
  Object.assign(fake.clerkJS, { __internal_state: signals.state });

  let signIn!: ReturnType<typeof useSignIn>['signIn'];
  const Form = () => {
    ({ signIn } = useSignIn());
    return <p data-testid="trust">{signIn.clientTrustState ?? 'undefined'}</p>;
  };
  render(() => (
    <ClerkProvider
      publishableKey={TEST_PUBLISHABLE_KEY}
      Clerk={fake.clerkJS as any}
    >
      <Form />
    </ClerkProvider>
  ));
  const trust = () => screen.getByTestId('trust').textContent;

  // The stand-in has the property, as @clerk/react's does, so code that
  // checks for it (or spreads the resource) sees it before load.
  expect('clientTrustState' in signIn).toBe(true);
  expect(trust()).toBe('undefined');

  finishLoading();
  await vi.waitFor(() => expect(trust()).toBe('pending'));

  // clerk-js updates the resource in place and emits the signal again.
  future.trust();
  signals.set('signIn', { fetchStatus: 'idle' });
  expect(trust()).toBe('known');
});
