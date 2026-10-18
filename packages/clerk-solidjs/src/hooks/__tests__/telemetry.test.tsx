import type { ClerkStatus } from '@clerk/shared/types';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  useAuth,
  useOrganization,
  useOrganizationList,
  useSession,
  useSessionList,
  useSignIn,
  useSignUp,
  useUser
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

afterEach(() => {
  cleanup();
});

describe('hook telemetry', () => {
  it('records one METHOD_CALLED event per hook once Clerk loads, and no more on later status changes', async () => {
    const { clerkJS } = createFakeClerkJS();
    const record = vi.fn();
    const handlers = new Set<(status: ClerkStatus) => void>();
    let status: ClerkStatus = 'loading';
    Object.assign(clerkJS, {
      telemetry: { record },
      get status() {
        return status;
      },
      on: (
        _event: 'status',
        handler: (status: ClerkStatus) => void,
        opts?: { notify?: boolean }
      ) => {
        handlers.add(handler);
        if (opts?.notify) handler(status);
      },
      off: (_event: 'status', handler: (status: ClerkStatus) => void) =>
        handlers.delete(handler)
    });
    clerkJS.load.mockImplementation(async () => {
      clerkJS.loaded = true;
      status = 'ready';
    });

    const Hooks = () => {
      useAuth({ treatPendingAsSignedOut: false });
      useUser();
      useSession();
      useSessionList();
      useSignIn();
      useSignUp();
      useOrganization();
      useOrganizationList();
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Hooks />
      </ClerkProvider>
    ));

    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(8));

    status = 'degraded';
    handlers.forEach((handler) => handler('degraded'));
    await Promise.resolve();

    const events = record.mock.calls.map(([event]) => event);
    expect(events.map((event) => event.payload.method).sort()).toEqual([
      'useAuth',
      'useOrganization',
      'useOrganizationList',
      'useSession',
      'useSessionList',
      'useSignIn',
      'useSignUp',
      'useUser'
    ]);
    expect(events.every((event) => event.event === 'METHOD_CALLED')).toBe(true);
    expect(
      events.find((event) => event.payload.method === 'useAuth').payload
    ).toMatchObject({ treatPendingAsSignedOut: false });
  });
});
