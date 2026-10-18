import type { ClerkStatus } from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkDegraded,
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  useAuth
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

/**
 * A fake clerk-js with Core 3's status event: `load()` reports `ready`, or
 * the status passed in.
 */
const createClerkJSWithStatus = (loadedStatus: ClerkStatus = 'ready') => {
  const { clerkJS, emit } = createFakeClerkJS();
  const handlers = new Set<(status: ClerkStatus) => void>();
  let status: ClerkStatus = 'loading';
  const setStatus = (next: ClerkStatus) => {
    status = next;
    handlers.forEach((handler) => handler(next));
  };
  const withStatus = Object.assign(clerkJS, {
    get status() {
      return status;
    },
    on: vi.fn(
      (
        _event: 'status',
        handler: (status: ClerkStatus) => void,
        opts?: { notify?: boolean }
      ) => {
        handlers.add(handler);
        if (opts?.notify) handler(status);
      }
    ),
    off: vi.fn((_event: 'status', handler: (status: ClerkStatus) => void) => {
      handlers.delete(handler);
    })
  });
  clerkJS.load.mockImplementation(async () => {
    clerkJS.loaded = true;
    setStatus(loadedStatus);
  });
  return { clerkJS: withStatus, emit, setStatus };
};

const StatusComponents = () => (
  <>
    <ClerkLoading>
      <p>loading</p>
    </ClerkLoading>
    <ClerkLoaded>
      <p>loaded</p>
    </ClerkLoaded>
    <ClerkFailed>
      <p>failed</p>
    </ClerkFailed>
    <ClerkDegraded>
      <p>degraded</p>
    </ClerkDegraded>
  </>
);

const renderInProvider = (clerkJS: unknown) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      <StatusComponents />
    </ClerkProvider>
  ));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('load status components', () => {
  it('show ClerkFailed and drop ClerkLoading when clerk-js fails to load', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { clerkJS } = createFakeClerkJS();
    clerkJS.load.mockRejectedValue(new Error('blocked by the network'));

    renderInProvider(clerkJS);
    expect(screen.getByText('loading')).toBeTruthy();

    expect(await screen.findByText('failed')).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
    expect(screen.queryByText('loaded')).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it('follow clerk-js status once it loads', async () => {
    const { clerkJS, setStatus } = createClerkJSWithStatus();

    renderInProvider(clerkJS);
    expect(screen.getByText('loading')).toBeTruthy();

    expect(await screen.findByText('loaded')).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
    expect(screen.queryByText('degraded')).toBeNull();

    setStatus('degraded');
    expect(await screen.findByText('degraded')).toBeTruthy();
    expect(screen.getByText('loaded')).toBeTruthy();
  });

  it('count a degraded load as loaded', async () => {
    const { clerkJS } = createClerkJSWithStatus('degraded');

    renderInProvider(clerkJS);

    expect(await screen.findByText('degraded')).toBeTruthy();
    expect(screen.getByText('loaded')).toBeTruthy();
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('stop listening to clerk-js when the provider unmounts', async () => {
    const { clerkJS } = createClerkJSWithStatus();
    const { unmount } = renderInProvider(clerkJS);
    expect(await screen.findByText('loaded')).toBeTruthy();

    unmount();
    expect(clerkJS.off).toHaveBeenCalledWith('status', expect.any(Function));
  });
});

describe('getToken and signOut', () => {
  it('wait until Clerk is ready', async () => {
    const getToken = vi.fn(async () => 'jwt');
    const user = { id: 'user_1', organizationMemberships: [] } as any;
    const { clerkJS } = createFakeClerkJS({
      user,
      session: {
        id: 'sess_1',
        status: 'active',
        user,
        getToken,
        lastActiveToken: { jwt: { claims: { sid: 'sess_1' } } }
      } as any
    });
    const signOut = vi.fn(async () => {});
    Object.assign(clerkJS, { signOut });
    let release!: () => void;
    clerkJS.load.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            clerkJS.loaded = true;
            resolve();
          };
        })
    );

    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => {
      auth = useAuth();
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Probe />
      </ClerkProvider>
    ));

    const token = auth.getToken();
    const signedOut = auth.signOut();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await Promise.resolve();
    expect(getToken).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();

    release();
    await expect(token).resolves.toBe('jwt');
    await signedOut;
    expect(signOut).toHaveBeenCalledOnce();
  });
});
