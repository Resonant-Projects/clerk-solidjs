import type { WaitlistProps } from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import type { JSX } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  OrganizationSwitcher,
  SignIn,
  UserButton,
  Waitlist
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

/** clerk-js that renders a component's content when it mounts. */
const createClerkJS = () => {
  const { clerkJS } = createFakeClerkJS();
  const renderInto = (node: HTMLDivElement) => {
    const content = document.createElement('div');
    content.textContent = 'clerk content';
    node.appendChild(content);
  };
  return Object.assign(clerkJS, {
    mountSignIn: vi.fn(renderInto),
    mountUserButton: vi.fn(renderInto),
    mountOrganizationSwitcher: vi.fn(),
    unmountOrganizationSwitcher: vi.fn(),
    mountWaitlist: vi.fn(),
    unmountWaitlist: vi.fn()
  });
};

type ClerkJS = ReturnType<typeof createClerkJS>;

const renderInProvider = (clerkJS: ClerkJS, ui: () => JSX.Element) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

afterEach(() => {
  cleanup();
});

describe('UI component fallback and pre-load rendering', () => {
  it('render the host element and fallback before Clerk loads, then mount once it has', async () => {
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
    const { container } = renderInProvider(clerkJS, () => (
      <SignIn path="/sign-in" fallback={<p>loading sign-in</p>} />
    ));

    const host = container.querySelector('[data-clerk-component="SignIn"]');
    expect(host).toBeTruthy();
    expect(screen.getByText('loading sign-in')).toBeTruthy();
    expect(clerkJS.mountSignIn).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(finishLoading).toBeTypeOf('function'));
    finishLoading();

    await vi.waitFor(() =>
      expect(clerkJS.mountSignIn).toHaveBeenCalledWith(host, {
        path: '/sign-in'
      })
    );
    await vi.waitFor(() =>
      expect(screen.queryByText('loading sign-in')).toBeNull()
    );
    expect(host!.textContent).toBe('clerk content');
  });

  it('keep the fallback until Clerk renders, and keep it out of the props', async () => {
    const clerkJS = createClerkJS();
    renderInProvider(clerkJS, () => (
      <>
        <UserButton fallback={<p>avatar</p>} />
        <OrganizationSwitcher fallback={<p>switcher</p>} hidePersonal />
      </>
    ));

    await vi.waitFor(() =>
      expect(clerkJS.mountOrganizationSwitcher).toHaveBeenCalled()
    );
    // UserButton rendered content; OrganizationSwitcher has not yet.
    await vi.waitFor(() => expect(screen.queryByText('avatar')).toBeNull());
    expect(screen.getByText('switcher')).toBeTruthy();

    const [, userButtonProps] = clerkJS.mountUserButton.mock.calls[0]!;
    const [, switcherProps] = clerkJS.mountOrganizationSwitcher.mock.calls[0]!;
    expect(userButtonProps).not.toHaveProperty('fallback');
    expect(switcherProps).not.toHaveProperty('fallback');
    expect(switcherProps).toMatchObject({ hidePersonal: true });
  });

  it('type Waitlist with WaitlistProps', () => {
    expectTypeOf<Parameters<typeof Waitlist>[0]>().toMatchTypeOf<
      Partial<WaitlistProps>
    >();
    expectTypeOf({
      afterJoinWaitlistUrl: '/joined',
      signInUrl: '/sign-in'
    }).toMatchTypeOf<Parameters<typeof Waitlist>[0]>();
  });
});
