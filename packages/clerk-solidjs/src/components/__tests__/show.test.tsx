import type {
  OrganizationMembershipResource,
  OrganizationResource,
  SignedInSessionResource,
  UserResource
} from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { createSignal, type JSX, untrack } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import * as entry from '../..';
import { ClerkProvider, ClerkShow, Show } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const organization = { id: 'org_1', slug: 'acme' } as OrganizationResource;

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

const session = (status: 'active' | 'pending' = 'active') =>
  ({
    id: 'sess_1',
    status,
    user,
    factorVerificationAge: [1, 1],
    lastActiveToken: {
      jwt: { claims: { sid: 'sess_1', fea: 'u:analytics', pla: 'u:pro' } }
    }
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

describe('<Show>', () => {
  it('renders nothing, not even the fallback, until auth has loaded', async () => {
    const { clerkJS } = signedIn();
    renderInProvider(clerkJS, () => (
      <Show when="signed-in" fallback={<p>fallback</p>}>
        <p>content</p>
      </Show>
    ));

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.queryByText('fallback')).toBeNull();
    expect(await screen.findByText('content')).toBeTruthy();
  });

  it('handles "signed-in" and "signed-out"', async () => {
    const { clerkJS, emit } = signedIn();
    renderInProvider(clerkJS, () => (
      <>
        <Show when="signed-in">
          <p>in</p>
        </Show>
        <Show when="signed-out">
          <p>out</p>
        </Show>
      </>
    ));

    expect(await screen.findByText('in')).toBeTruthy();
    expect(screen.queryByText('out')).toBeNull();

    emit({ session: null, user: null, organization: null });
    expect(await screen.findByText('out')).toBeTruthy();
    expect(screen.queryByText('in')).toBeNull();
  });

  it('checks roles, permissions, features and plans, and takes a has() predicate', async () => {
    const { clerkJS } = signedIn();
    renderInProvider(clerkJS, () => (
      <>
        <Show when={{ role: 'org:admin' }}>
          <p>role</p>
        </Show>
        <Show when={{ permission: 'org:sys_memberships:manage' }}>
          <p>permission</p>
        </Show>
        <Show when={{ feature: 'analytics' }}>
          <p>feature</p>
        </Show>
        <Show when={{ plan: 'pro' }}>
          <p>plan</p>
        </Show>
        <Show when={{ feature: 'sso' }} fallback={<p>no-sso</p>}>
          <p>sso</p>
        </Show>
        <Show
          when={(has) => has({ role: 'org:member' })}
          fallback={<p>no-member</p>}
        >
          <p>member</p>
        </Show>
      </>
    ));

    expect(await screen.findByText('role')).toBeTruthy();
    expect(screen.getByText('permission')).toBeTruthy();
    expect(screen.getByText('feature')).toBeTruthy();
    expect(screen.getByText('plan')).toBeTruthy();
    expect(screen.getByText('no-sso')).toBeTruthy();
    expect(screen.queryByText('sso')).toBeNull();
    expect(screen.getByText('no-member')).toBeTruthy();
  });

  it('shows the fallback for an authorization check while signed out', async () => {
    const { clerkJS } = createFakeClerkJS();
    renderInProvider(clerkJS, () => (
      <Show when={() => true} fallback={<p>fallback</p>}>
        <p>content</p>
      </Show>
    ));

    expect(await screen.findByText('fallback')).toBeTruthy();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('treats a pending session as signed out unless told otherwise', async () => {
    const { clerkJS } = signedIn('pending');
    renderInProvider(clerkJS, () => (
      <>
        <Show when="signed-in" fallback={<p>default-out</p>}>
          <p>default-in</p>
        </Show>
        <Show when="signed-in" treatPendingAsSignedOut={false}>
          <p>opted-in</p>
        </Show>
      </>
    ));

    expect(await screen.findByText('default-out')).toBeTruthy();
    expect(screen.queryByText('default-in')).toBeNull();
    expect(screen.getByText('opted-in')).toBeTruthy();
  });

  it('never creates its children while unauthorized or pending', async () => {
    const setups: string[] = [];
    const Child = (props: { name: string }) => {
      setups.push(untrack(() => props.name));
      return <p>{props.name}</p>;
    };

    const signedOut = createFakeClerkJS();
    renderInProvider(signedOut.clerkJS, () => (
      <Show when="signed-in" fallback={<p>signed-out-fallback</p>}>
        <Child name="signed-out" />
      </Show>
    ));
    expect(await screen.findByText('signed-out-fallback')).toBeTruthy();
    cleanup();

    const pending = signedIn('pending');
    renderInProvider(pending.clerkJS, () => (
      <Show when="signed-in" fallback={<p>pending-fallback</p>}>
        <Child name="pending" />
      </Show>
    ));
    expect(await screen.findByText('pending-fallback')).toBeTruthy();
    cleanup();

    const admin = signedIn();
    renderInProvider(admin.clerkJS, () => (
      <Show when={{ role: 'org:billing' }} fallback={<p>role-fallback</p>}>
        <Child name="wrong-role" />
      </Show>
    ));
    expect(await screen.findByText('role-fallback')).toBeTruthy();

    expect(setups).toEqual([]);
  });

  it('follows a reactive when', async () => {
    const { clerkJS } = signedIn();
    const [when, setWhen] = createSignal<'signed-in' | 'signed-out'>(
      'signed-out'
    );
    renderInProvider(clerkJS, () => (
      <Show when={when()} fallback={<p>fallback</p>}>
        <p>content</p>
      </Show>
    ));

    expect(await screen.findByText('fallback')).toBeTruthy();
    setWhen('signed-in');
    expect(await screen.findByText('content')).toBeTruthy();
  });

  it('is exported as ClerkShow too', () => {
    expect(ClerkShow).toBe(Show);
  });
});

describe('the 4.0 entry', () => {
  it('no longer has SignedIn, SignedOut and Protect, which Show replaces', () => {
    expect(entry).not.toHaveProperty('SignedIn');
    expect(entry).not.toHaveProperty('SignedOut');
    expect(entry).not.toHaveProperty('Protect');
  });
});
