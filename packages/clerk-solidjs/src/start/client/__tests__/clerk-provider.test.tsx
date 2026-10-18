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
});

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
});
