import type {
  OrganizationMembershipResource,
  OrganizationResource,
  SignedInSessionResource,
  UserResource
} from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { createEffect, type JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  Protect,
  SignedIn,
  SignedOut,
  useAuth,
  useSession,
  useUser
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const organization = {
  id: 'org_1',
  slug: 'acme'
} as unknown as OrganizationResource;

const user = {
  id: 'user_1',
  organizationMemberships: [
    {
      id: 'orgmem_1',
      role: 'org:admin',
      permissions: ['org:sys_memberships:manage'],
      organization: { id: 'org_1' }
    } as unknown as OrganizationMembershipResource
  ]
} as unknown as UserResource;

const session = (
  status: 'active' | 'pending' = 'active',
  claims: Record<string, unknown> = { fea: 'u:analytics', pla: 'u:pro' }
) =>
  ({
    id: 'sess_1',
    status,
    user,
    factorVerificationAge: [1, 1],
    lastActiveToken: { jwt: { claims: { sid: 'sess_1', ...claims } } }
  }) as unknown as SignedInSessionResource;

const signedIn = (status: 'active' | 'pending' = 'active') =>
  createFakeClerkJS({ user, organization, session: session(status) });

const renderInProvider = (
  clerkJS: ReturnType<typeof createFakeClerkJS>['clerkJS'],
  ui: () => JSX.Element
) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

afterEach(() => {
  cleanup();
});

describe('useAuth', () => {
  it('reports loading until Clerk loads, and has() is false meanwhile', async () => {
    const { clerkJS } = signedIn();
    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => {
      auth = useAuth();
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    expect(auth.isLoaded()).toBe(false);
    expect(auth.isSignedIn()).toBeUndefined();
    expect(auth.has({ role: 'org:admin' })).toBe(false);

    await vi.waitFor(() => expect(auth.isSignedIn()).toBe(true));
  });

  it('checks roles, permissions, features and plans like @clerk/shared', async () => {
    const { clerkJS } = signedIn();
    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => {
      auth = useAuth();
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(auth.isSignedIn()).toBe(true));

    expect(auth.userId()).toBe('user_1');
    expect(auth.sessionId()).toBe('sess_1');
    expect(auth.orgId()).toBe('org_1');
    expect(auth.orgRole()).toBe('org:admin');
    expect(auth.orgSlug()).toBe('acme');
    expect(auth.sessionClaims()?.sid).toBe('sess_1');

    // Roles and permissions get the org: prefix.
    expect(auth.has({ role: 'admin' })).toBe(true);
    expect(auth.has({ permission: 'sys_memberships:manage' })).toBe(true);
    // Every requested dimension must pass. The public type forbids mixing
    // role and permission, but @clerk/shared ANDs them at runtime.
    expect(
      auth.has({
        role: 'org:admin',
        permission: 'org:sys_domains:manage'
      } as unknown as Parameters<typeof auth.has>[0])
    ).toBe(false);
    expect(auth.has({ feature: 'analytics' })).toBe(true);
    expect(auth.has({ plan: 'pro' })).toBe(true);
    expect(auth.has({ feature: 'sso' })).toBe(false);
    // Nothing requested is not a match, and does not throw.
    expect(auth.has({})).toBe(false);
  });

  it('treats a pending session as signed out by default', async () => {
    const { clerkJS } = signedIn('pending');
    let auth!: ReturnType<typeof useAuth>;
    let lenient!: ReturnType<typeof useAuth>;
    const Probe = () => {
      auth = useAuth();
      lenient = useAuth({ treatPendingAsSignedOut: false });
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(auth.isLoaded()).toBe(true));

    expect(auth.isSignedIn()).toBe(false);
    expect(auth.userId()).toBeNull();
    expect(auth.orgId()).toBeNull();
    expect(auth.orgPermissions()).toBeNull();
    expect(auth.has({ role: 'org:admin' })).toBe(false);

    expect(lenient.isSignedIn()).toBe(true);
    expect(lenient.userId()).toBe('user_1');
  });

  it('re-runs consumers of a field only when that field changes', async () => {
    const { clerkJS, emit } = signedIn();
    let userIdRuns = 0;
    const Probe = () => {
      const auth = useAuth();
      createEffect(() => {
        auth.userId();
        userIdRuns++;
      });
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));
    const runsAfterLoad = userIdRuns;

    // A new organization object (as after a refresh) leaves userId alone.
    emit({ organization: { ...organization } as OrganizationResource });
    emit({ organization: { ...organization } as OrganizationResource });

    expect(userIdRuns).toBe(runsAfterLoad);
  });
});

describe('control components with a pending session', () => {
  it('show signed-out content by default and signed-in content when opted out', async () => {
    const { clerkJS } = signedIn('pending');

    renderInProvider(clerkJS, () => (
      <>
        <SignedIn>
          <p>signed-in</p>
        </SignedIn>
        <SignedOut>
          <p>signed-out</p>
        </SignedOut>
        <SignedIn treatPendingAsSignedOut={false}>
          <p>signed-in-lenient</p>
        </SignedIn>
        <Protect fallback={<p>protect-fallback</p>} role="org:admin">
          <p>protected</p>
        </Protect>
      </>
    ));

    await screen.findByText('signed-out');
    expect(screen.getByText('signed-in-lenient')).toBeTruthy();
    expect(screen.queryByText('signed-in')).toBeNull();
    expect(screen.getByText('protect-fallback')).toBeTruthy();
    expect(screen.queryByText('protected')).toBeNull();
  });

  it('show signed-in content for an active session', async () => {
    const { clerkJS } = signedIn('active');

    renderInProvider(clerkJS, () => (
      <>
        <SignedIn>
          <p>signed-in</p>
        </SignedIn>
        <SignedOut>
          <p>signed-out</p>
        </SignedOut>
        <Protect fallback={<p>protect-fallback</p>} role="org:admin">
          <p>protected</p>
        </Protect>
      </>
    ));

    await screen.findByText('signed-in');
    expect(screen.queryByText('signed-out')).toBeNull();
    expect(screen.getByText('protected')).toBeTruthy();
  });
});

describe('useUser and useSession', () => {
  it('report isSignedIn as undefined while loading, then the real value', async () => {
    const { clerkJS } = signedIn('pending');
    let userState!: ReturnType<typeof useUser>;
    let sessionState!: ReturnType<typeof useSession>;
    const Probe = () => {
      userState = useUser();
      sessionState = useSession();
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    expect(userState.isSignedIn()).toBeUndefined();
    expect(sessionState.isSignedIn()).toBeUndefined();

    await vi.waitFor(() => expect(userState.isLoaded()).toBe(true));
    expect(userState.isSignedIn()).toBe(true);
    // A pending session is not signed in, as in Clerk Core 3.
    expect(sessionState.isSignedIn()).toBe(false);
  });
});
