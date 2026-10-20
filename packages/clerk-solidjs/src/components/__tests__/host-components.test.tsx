import { cleanup, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as entry from '../..';
import {
  APIKeys,
  ClerkProvider,
  InviteMembersButton,
  OAuthConsent,
  OAuthDeviceVerification,
  PricingTable,
  SignInButton,
  UNSAFE_PortalProvider,
  UserAvatar,
  UserButton
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const setup = () => {
  const { clerkJS } = createFakeClerkJS();
  const members = {
    mountPricingTable: vi.fn(),
    unmountPricingTable: vi.fn(),
    mountAPIKeys: vi.fn(),
    unmountAPIKeys: vi.fn(),
    mountUserAvatar: vi.fn(),
    unmountUserAvatar: vi.fn(),
    __internal_mountOAuthConsent: vi.fn(),
    __internal_unmountOAuthConsent: vi.fn(),
    __internal_mountOAuthDeviceVerification: vi.fn(),
    __internal_unmountOAuthDeviceVerification: vi.fn(),
    openInviteMembers: vi.fn(),
    openSignIn: vi.fn()
  };
  return { clerkJS: Object.assign(clerkJS, members) as any, members };
};

afterEach(() => {
  cleanup();
});

describe('Rung 4 host components', () => {
  it('mount through their clerk-js methods, and unmount', async () => {
    const { clerkJS, members } = setup();
    const { unmount } = render(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS}>
        <APIKeys perPage={5} />
        <UserAvatar rounded />
        <OAuthConsent scope="openid" />
        <OAuthDeviceVerification />
      </ClerkProvider>
    ));

    await vi.waitFor(() =>
      expect(members.__internal_mountOAuthDeviceVerification).toHaveBeenCalled()
    );
    expect(members.mountAPIKeys.mock.calls[0]![1]).toMatchObject({
      perPage: 5
    });
    expect(members.mountUserAvatar.mock.calls[0]![1]).toMatchObject({
      rounded: true
    });
    expect(
      members.__internal_mountOAuthConsent.mock.calls[0]![1]
    ).toMatchObject({ scope: 'openid' });
    expect(
      (members.mountAPIKeys.mock.calls[0]![0] as HTMLElement).dataset
        .clerkComponent
    ).toBe('ApiKeys');

    unmount();
    expect(members.unmountAPIKeys).toHaveBeenCalled();
    expect(members.unmountUserAvatar).toHaveBeenCalled();
    expect(members.__internal_unmountOAuthConsent).toHaveBeenCalled();
    expect(
      members.__internal_unmountOAuthDeviceVerification
    ).toHaveBeenCalled();
  });

  it('PricingTable keeps its fallback until Clerk marks it ready, and updates its props', async () => {
    const { clerkJS, members } = setup();
    const [newSubscriptionRedirectUrl, setUrl] = createSignal('/first');
    render(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS}>
        <PricingTable
          newSubscriptionRedirectUrl={newSubscriptionRedirectUrl()}
          fallback={<p>Loading plans...</p>}
        />
      </ClerkProvider>
    ));

    await vi.waitFor(() =>
      expect(members.mountPricingTable).toHaveBeenCalled()
    );
    const [node] = members.mountPricingTable.mock.calls[0]! as [HTMLElement];
    // clerk-js marks the node it was given, as @clerk/react expects. Rendered,
    // but the plans have not loaded:
    node.append(document.createElement('div'));
    node.dataset.componentStatus = 'awaiting-data';
    await Promise.resolve();
    expect(screen.getByText('Loading plans...')).toBeTruthy();

    node.dataset.componentStatus = 'ready';
    await vi.waitFor(() =>
      expect(screen.queryByText('Loading plans...')).toBeNull()
    );

    setUrl('/second');
    await vi.waitFor(() =>
      expect(clerkJS.__internal_updateProps).toHaveBeenCalledWith(
        expect.objectContaining({
          node,
          props: expect.objectContaining({
            newSubscriptionRedirectUrl: '/second'
          })
        })
      )
    );
  });

  it('InviteMembersButton opens the invite modal with its appearance', async () => {
    const { clerkJS, members } = setup();
    render(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS}>
        <InviteMembersButton
          appearance={{ variables: { colorPrimary: 'red' } }}
        />
      </ClerkProvider>
    ));

    screen.getByRole('button', { name: 'Invite members' }).click();
    await vi.waitFor(() =>
      expect(members.openInviteMembers).toHaveBeenCalled()
    );
    expect(members.openInviteMembers).toHaveBeenCalledWith({
      appearance: { variables: { colorPrimary: 'red' } },
      getContainer: undefined
    });
  });

  it('exports getToken from the root entry', () => {
    expect(entry.getToken).toBeTypeOf('function');
  });
});

describe('UNSAFE_PortalProvider', () => {
  it('hands its container to mounted components and to the modals buttons open', async () => {
    const { clerkJS, members } = setup();
    Object.assign(clerkJS, { mountUserButton: vi.fn() });
    const container = document.createElement('section');
    render(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS}>
        <UNSAFE_PortalProvider getContainer={() => container}>
          <UserButton />
          <SignInButton mode="modal" />
        </UNSAFE_PortalProvider>
        <UserAvatar />
      </ClerkProvider>
    ));

    await vi.waitFor(() => expect(clerkJS.mountUserButton).toHaveBeenCalled());
    const { getContainer } = clerkJS.mountUserButton.mock.calls[0][1];
    expect(getContainer()).toBe(container);
    // Outside the provider, Clerk's default container.
    await vi.waitFor(() => expect(members.mountUserAvatar).toHaveBeenCalled());
    expect(members.mountUserAvatar.mock.calls[0]![1]).not.toHaveProperty(
      'getContainer'
    );

    screen.getByRole('button', { name: /sign in/i }).click();
    await vi.waitFor(() => expect(members.openSignIn).toHaveBeenCalled());
    expect(members.openSignIn.mock.calls[0]![0].getContainer()).toBe(container);
  });
});
