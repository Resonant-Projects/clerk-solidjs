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

  it('logs instead of rejecting when the UI script fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    scripts.loadClerkUIScript.mockResolvedValue(null);

    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX'
    });
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());

    expect(String(consoleError.mock.calls[0][0])).toContain(
      'Failed to download latest Clerk UI'
    );
    expect(isomorphicClerk.loaded).toBe(false);
    consoleError.mockRestore();
  });
});
