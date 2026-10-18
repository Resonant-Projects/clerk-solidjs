import type { ClerkStatus } from '@clerk/shared/types';
import { mergeProps } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scripts = vi.hoisted(() => ({
  loadClerkJSScript: vi.fn(),
  loadClerkUIScript: vi.fn()
}));

vi.mock('@clerk/shared/loadClerkJsScript', () => scripts);

import { IsomorphicClerk } from '../isomorphic-clerk';

const createClerkJS = () => {
  const clerkJS = {
    loaded: false,
    load: vi.fn<(options: any) => Promise<void>>(async () => {
      clerkJS.loaded = true;
    }),
    addListener: vi.fn()
  };
  return clerkJS;
};

const loadOptions = (clerkJS: ReturnType<typeof createClerkJS>) =>
  clerkJS.load.mock.calls[0]?.[0];

const ClerkUICtor = vi.fn() as any;

const loadedClerk = async (isomorphicClerk: IsomorphicClerk) => {
  await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));
};

describe('IsomorphicClerk Core 3 loading', () => {
  let clerkJS: ReturnType<typeof createClerkJS>;

  beforeEach(() => {
    clerkJS = createClerkJS();
    globalThis.Clerk = undefined;
    globalThis.__internal_ClerkUICtor = undefined;
    scripts.loadClerkJSScript.mockImplementation(async () => {
      globalThis.Clerk = clerkJS as any;
      return null;
    });
    scripts.loadClerkUIScript.mockImplementation(async () => {
      globalThis.__internal_ClerkUICtor = ClerkUICtor;
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.Clerk = undefined;
    globalThis.__internal_ClerkUICtor = undefined;
  });

  it('loads clerk-js and the Clerk UI from the CDN and passes ClerkUI to load()', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX'
    });
    await loadedClerk(isomorphicClerk);

    expect(scripts.loadClerkJSScript).toHaveBeenCalledOnce();
    expect(scripts.loadClerkUIScript).toHaveBeenCalledOnce();
    expect(scripts.loadClerkUIScript.mock.calls[0][0]).toMatchObject({
      publishableKey: 'pk_test_XXX'
    });
    expect(loadOptions(clerkJS).ui.ClerkUI).toBe(ClerkUICtor);
  });

  it('forwards internal script URLs and versions to the shared loaders', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      __internal_clerkJSVersion: '6.39.0',
      __internal_clerkUIVersion: '1.40.2'
    });
    await loadedClerk(isomorphicClerk);

    expect(scripts.loadClerkJSScript.mock.calls[0][0]).toMatchObject({
      __internal_clerkJSVersion: '6.39.0'
    });
    expect(scripts.loadClerkUIScript.mock.calls[0][0]).toMatchObject({
      __internal_clerkUIVersion: '1.40.2'
    });
  });

  it('uses a bundled ClerkUI instead of the CDN', async () => {
    const BundledUI = vi.fn() as any;
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      ui: { ClerkUI: BundledUI }
    });
    await loadedClerk(isomorphicClerk);

    expect(scripts.loadClerkUIScript).not.toHaveBeenCalled();
    expect(loadOptions(clerkJS).ui.ClerkUI).toBe(BundledUI);
  });

  it('skips the UI script when prefetchUI is false', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      prefetchUI: false
    });
    await loadedClerk(isomorphicClerk);

    expect(scripts.loadClerkUIScript).not.toHaveBeenCalled();
    expect(loadOptions(clerkJS).ui.ClerkUI).toBeUndefined();
  });

  it('uses a Clerk instance passed by the app without hot-loading', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    await loadedClerk(isomorphicClerk);

    expect(scripts.loadClerkJSScript).not.toHaveBeenCalled();
    expect(scripts.loadClerkUIScript).not.toHaveBeenCalled();
    expect(clerkJS.load).toHaveBeenCalledOnce();
  });

  it('mounts organization components rendered before clerk-js loads', async () => {
    const mounts = {
      mountOrganizationProfile: vi.fn(),
      mountCreateOrganization: vi.fn(),
      mountOrganizationSwitcher: vi.fn()
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, mounts) as any
    });
    expect(isomorphicClerk.loaded).toBe(false);
    const profileNode = document.createElement('div');
    const createNode = document.createElement('div');
    const switcherNode = document.createElement('div');
    isomorphicClerk.mountOrganizationProfile(profileNode, { routing: 'hash' });
    isomorphicClerk.mountCreateOrganization(createNode, { routing: 'hash' });
    isomorphicClerk.mountOrganizationSwitcher(switcherNode, {
      hidePersonal: true
    });

    await loadedClerk(isomorphicClerk);

    expect(mounts.mountOrganizationProfile).toHaveBeenCalledWith(profileNode, {
      routing: 'hash'
    });
    expect(mounts.mountCreateOrganization).toHaveBeenCalledWith(createNode, {
      routing: 'hash'
    });
    expect(mounts.mountOrganizationSwitcher).toHaveBeenCalledWith(
      switcherNode,
      { hidePersonal: true }
    );
  });

  it('logs and reports the error status instead of rejecting when the UI script fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    scripts.loadClerkUIScript.mockResolvedValue(null);

    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX'
    });
    const statuses: ClerkStatus[] = [];
    isomorphicClerk.on('status', (status) => statuses.push(status), {
      notify: true
    });
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());

    expect(String(consoleError.mock.calls[0][0])).toContain(
      'Failed to download latest Clerk UI'
    );
    expect(isomorphicClerk.loaded).toBe(false);
    expect(isomorphicClerk.status).toBe('error');
    expect(statuses).toEqual(['loading', 'error']);
    consoleError.mockRestore();
  });

  it('reports the error status when the clerk-js script fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    scripts.loadClerkJSScript.mockRejectedValue(new Error('blocked'));

    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX'
    });

    await vi.waitFor(() => expect(isomorphicClerk.status).toBe('error'));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('hands status listeners to clerk-js once it loads, with its current status', async () => {
    const handlers = new Set<(status: ClerkStatus) => void>();
    const withStatus = Object.assign(clerkJS, {
      status: 'loading' as ClerkStatus,
      on: vi.fn(
        (
          _event: 'status',
          handler: (status: ClerkStatus) => void,
          opts?: { notify?: boolean }
        ) => {
          handlers.add(handler);
          if (opts?.notify) handler(withStatus.status);
        }
      ),
      off: vi.fn()
    });
    clerkJS.load.mockImplementation(async () => {
      clerkJS.loaded = true;
      withStatus.status = 'ready';
    });

    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: withStatus as any
    });
    const statuses: ClerkStatus[] = [];
    const listener = (status: ClerkStatus) => {
      statuses.push(status);
      // A listener told `ready` can use the instance straight away.
      if (status === 'ready') expect(isomorphicClerk.loaded).toBe(true);
    };
    isomorphicClerk.on('status', listener, { notify: true });
    await loadedClerk(isomorphicClerk);

    expect(withStatus.on).toHaveBeenCalledWith('status', listener, {
      notify: true
    });
    expect(statuses).toEqual(['loading', 'ready']);
    expect(isomorphicClerk.status).toBe('ready');

    withStatus.status = 'degraded';
    handlers.forEach((handler) => handler('degraded'));
    expect(statuses).toEqual(['loading', 'ready', 'degraded']);
    expect(isomorphicClerk.status).toBe('degraded');
  });

  it('hands every status listener over, even when one unsubscribes as it is told ready', async () => {
    const withStatus = Object.assign(clerkJS, {
      status: 'loading' as ClerkStatus,
      on: vi.fn(
        (
          _event: 'status',
          handler: (status: ClerkStatus) => void,
          opts?: { notify?: boolean }
        ) => {
          if (opts?.notify) handler(withStatus.status);
        }
      ),
      off: vi.fn()
    });
    clerkJS.load.mockImplementation(async () => {
      clerkJS.loaded = true;
      withStatus.status = 'ready';
    });
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: withStatus as any
    });
    const oneShot = (status: ClerkStatus) => {
      if (status === 'ready') isomorphicClerk.off('status', oneShot);
    };
    const second = vi.fn();
    isomorphicClerk.on('status', oneShot);
    isomorphicClerk.on('status', second);
    await loadedClerk(isomorphicClerk);

    expect(second).toHaveBeenCalledWith('ready');
  });

  it('does not hand over a listener that an earlier notification removed', async () => {
    const withStatus = Object.assign(clerkJS, {
      status: 'loading' as ClerkStatus,
      on: vi.fn(
        (
          _event: 'status',
          handler: (status: ClerkStatus) => void,
          opts?: { notify?: boolean }
        ) => {
          if (opts?.notify) handler(withStatus.status);
        }
      ),
      off: vi.fn()
    });
    clerkJS.load.mockImplementation(async () => {
      clerkJS.loaded = true;
      withStatus.status = 'ready';
    });
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: withStatus as any
    });
    const later = vi.fn();
    // Like the provider disposing a subtree whose cleanup unsubscribes.
    const first = (status: ClerkStatus) => {
      if (status === 'ready') isomorphicClerk.off('status', later);
    };
    isomorphicClerk.on('status', first);
    isomorphicClerk.on('status', later);
    await loadedClerk(isomorphicClerk);

    expect(later).not.toHaveBeenCalled();
    expect(withStatus.on).not.toHaveBeenCalledWith('status', later, {
      notify: true
    });
  });

  it('reports ready for a clerk-js without a status of its own', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    const statuses: ClerkStatus[] = [];
    isomorphicClerk.on('status', (status) => statuses.push(status), {
      notify: true
    });
    await loadedClerk(isomorphicClerk);

    expect(statuses).toEqual(['loading', 'ready']);
    expect(isomorphicClerk.status).toBe('ready');
  });

  it('passes its SDK metadata to clerk-js without writing to the options', async () => {
    // Solid props proxies, such as the SolidStart provider's, ignore writes.
    const options = mergeProps({ publishableKey: 'pk_test_XXX' });
    const isomorphicClerk = new IsomorphicClerk(options);
    await loadedClerk(isomorphicClerk);

    expect(loadOptions(clerkJS).sdkMetadata).toEqual({
      name: PACKAGE_NAME,
      version: PACKAGE_VERSION,
      environment: process.env.NODE_ENV
    });
    expect('sdkMetadata' in options).toBe(false);
  });

  it('passes SDK metadata an app or framework provides', async () => {
    const sdkMetadata = { name: 'custom-sdk', version: '1.0.0' };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      sdkMetadata
    });
    await loadedClerk(isomorphicClerk);

    expect(loadOptions(clerkJS).sdkMetadata).toBe(sdkMetadata);
  });
});
