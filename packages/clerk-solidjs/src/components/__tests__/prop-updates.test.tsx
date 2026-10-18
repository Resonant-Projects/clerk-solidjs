import { cleanup, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider, SignIn } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

afterEach(() => {
  cleanup();
});

const updatesWith = (
  clerkJS: ReturnType<typeof createFakeClerkJS>['clerkJS'],
  match: (update: any) => boolean
) =>
  clerkJS.__internal_updateProps.mock.calls.filter(([update]) => match(update));

describe('prop updates reach clerk-js', () => {
  it('sends a changed ClerkProvider appearance to __internal_updateProps', async () => {
    const { clerkJS } = createFakeClerkJS();
    const [appearance, setAppearance] = createSignal({
      variables: { colorPrimary: 'red' }
    });

    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
        appearance={appearance()}
      >
        <div />
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

    setAppearance({ variables: { colorPrimary: 'blue' } });

    await vi.waitFor(() =>
      expect(
        updatesWith(
          clerkJS,
          (update) => update.appearance?.variables?.colorPrimary === 'blue'
        )
      ).toHaveLength(1)
    );
  });

  it('sends a changed ClerkProvider localization to __internal_updateProps', async () => {
    const { clerkJS } = createFakeClerkJS();
    const [localization, setLocalization] = createSignal({
      locale: 'en-US'
    });

    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
        localization={localization()}
      >
        <div />
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

    setLocalization({ locale: 'fr-FR' });

    await vi.waitFor(() =>
      expect(
        updatesWith(
          clerkJS,
          (update) => update.options?.localization?.locale === 'fr-FR'
        )
      ).toHaveLength(1)
    );
  });

  it('sends the initial appearance and localization to a Clerk instance that has already loaded', async () => {
    const { clerkJS } = createFakeClerkJS();
    // A Clerk instance passed in loaded, or reused after a remount: load()
    // is skipped, so it never sees the provider's options.
    clerkJS.loaded = true;

    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
        appearance={{ variables: { colorPrimary: 'green' } }}
        localization={{ locale: 'de-DE' }}
      >
        <div />
      </ClerkProvider>
    ));

    await vi.waitFor(() => {
      expect(
        updatesWith(
          clerkJS,
          (update) => update.appearance?.variables?.colorPrimary === 'green'
        )
      ).toHaveLength(1);
      expect(
        updatesWith(
          clerkJS,
          (update) => update.options?.localization?.locale === 'de-DE'
        )
      ).toHaveLength(1);
    });
    expect(clerkJS.load).not.toHaveBeenCalled();
  });

  it('sends a changed <SignIn> prop to __internal_updateProps for its node', async () => {
    const { clerkJS } = createFakeClerkJS();
    const [path, setPath] = createSignal('/sign-in');

    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <SignIn path={path()} routing="path" />
      </ClerkProvider>
    ));
    await vi.waitFor(() =>
      expect(clerkJS.mountSignIn).toHaveBeenCalledTimes(1)
    );
    const [node, mountedProps] = clerkJS.mountSignIn.mock.calls[0] as any[];
    expect(mountedProps).toEqual({ path: '/sign-in', routing: 'path' });

    setPath('/login');

    await vi.waitFor(() =>
      expect(
        updatesWith(clerkJS, (update) => update.node === node)
      ).toHaveLength(1)
    );
    const [[update]] = updatesWith(clerkJS, (update) => update.node === node);
    expect(update.props).toEqual({ path: '/login', routing: 'path' });
    // clerk-js keeps the object it was given, so it must be a snapshot.
    expect(mountedProps).toEqual({ path: '/sign-in', routing: 'path' });
  });
});
