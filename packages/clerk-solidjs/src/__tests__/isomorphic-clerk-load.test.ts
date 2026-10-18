import type { ClerkStatus } from '@clerk/shared/types';
import { mergeProps } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scripts = vi.hoisted(() => ({
  loadClerkJSScript: vi.fn(),
  loadClerkUIScript: vi.fn(),
  setClerkJSLoadingErrorPackageName: vi.fn()
}));

vi.mock('@clerk/shared/loadClerkJsScript', () => scripts);

const navigation = vi.hoisted(() => ({
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  windowNavigate: vi.fn()
}));

vi.mock('@clerk/shared/internal/clerk-js/windowNavigate', () => navigation);

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

  it('names this package in clerk-js loading errors', () => {
    new IsomorphicClerk({ publishableKey: 'pk_test_XXX' });

    expect(scripts.setClerkJSLoadingErrorPackageName).toHaveBeenCalledWith(
      PACKAGE_NAME
    );
  });

  it('opens and mounts the Core 3 components called for before clerk-js loads', async () => {
    const members = {
      mountUserAvatar: vi.fn(),
      mountAPIKeys: vi.fn(),
      __internal_mountConfigureSSO: vi.fn(),
      __internal_mountConfigureDirectorySync: vi.fn(),
      __internal_mountOAuthConsent: vi.fn(),
      __internal_mountOAuthDeviceVerification: vi.fn(),
      openInviteMembers: vi.fn(),
      __internal_openEnableOrganizationsPrompt: vi.fn()
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, members) as any
    });
    const node = () => document.createElement('div');
    const [avatar, keys, sso, sync, consent, device, unmounted] = [
      node(),
      node(),
      node(),
      node(),
      node(),
      node(),
      node()
    ];
    isomorphicClerk.mountUserAvatar(avatar, { rounded: true });
    isomorphicClerk.mountAPIKeys(keys, { perPage: 5 });
    isomorphicClerk.__internal_mountConfigureSSO(sso);
    isomorphicClerk.__internal_mountConfigureDirectorySync(sync);
    isomorphicClerk.mountOAuthConsent(consent, { scope: 'openid' });
    isomorphicClerk.__internal_mountOAuthDeviceVerification(device);
    isomorphicClerk.mountAPIKeys(unmounted);
    isomorphicClerk.unmountAPIKeys(unmounted);
    isomorphicClerk.openInviteMembers({ appearance: {} } as any);
    isomorphicClerk.__internal_openEnableOrganizationsPrompt({
      caller: 'OrganizationSwitcher'
    } as any);

    await loadedClerk(isomorphicClerk);

    expect(members.mountUserAvatar).toHaveBeenCalledWith(avatar, {
      rounded: true
    });
    expect(members.mountAPIKeys).toHaveBeenCalledTimes(1);
    expect(members.mountAPIKeys).toHaveBeenCalledWith(keys, { perPage: 5 });
    expect(members.__internal_mountConfigureSSO).toHaveBeenCalledWith(
      sso,
      undefined
    );
    expect(members.__internal_mountConfigureDirectorySync).toHaveBeenCalledWith(
      sync,
      undefined
    );
    expect(members.__internal_mountOAuthConsent).toHaveBeenCalledWith(consent, {
      scope: 'openid'
    });
    expect(
      members.__internal_mountOAuthDeviceVerification
    ).toHaveBeenCalledWith(device, undefined);
    expect(members.openInviteMembers).toHaveBeenCalledWith({ appearance: {} });
    expect(
      members.__internal_openEnableOrganizationsPrompt
    ).toHaveBeenCalledWith({ caller: 'OrganizationSwitcher' });
  });

  it('skips directory sync and device verification on a clerk-js without them', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    const node = document.createElement('div');
    isomorphicClerk.__internal_mountConfigureDirectorySync(node);
    isomorphicClerk.__internal_mountOAuthDeviceVerification(node);

    await loadedClerk(isomorphicClerk);
    // After load too: neither call throws on the older clerk-js.
    isomorphicClerk.__internal_mountConfigureDirectorySync(node);
    isomorphicClerk.__internal_unmountConfigureDirectorySync(node);
    isomorphicClerk.__internal_mountOAuthDeviceVerification(node);
    isomorphicClerk.__internal_unmountOAuthDeviceVerification(node);
  });

  it('passes addListener options given before load to clerk-js', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    const listener = vi.fn();
    isomorphicClerk.addListener(listener, { skipInitialEmit: true });

    await loadedClerk(isomorphicClerk);

    expect(clerkJS.addListener).toHaveBeenCalledWith(listener, {
      skipInitialEmit: true
    });
  });

  it('reads its own options before clerk-js loads, and clerk-js after', async () => {
    const getOption = vi.fn(() => '/from-clerk-js');
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      signInUrl: '/sign-in',
      Clerk: Object.assign(clerkJS, { __internal_getOption: getOption }) as any
    });
    expect(isomorphicClerk.__internal_getOption('signInUrl')).toBe('/sign-in');

    await loadedClerk(isomorphicClerk);

    expect(isomorphicClerk.__internal_getOption('signInUrl')).toBe(
      '/from-clerk-js'
    );
    expect(getOption).toHaveBeenCalledWith('signInUrl');
  });

  it('queues authenticateWithBase and authenticateWithSolana until clerk-js loads', async () => {
    const members = {
      authenticateWithBase: vi.fn(async () => undefined),
      authenticateWithSolana: vi.fn(async () => undefined)
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, members) as any
    });
    void isomorphicClerk.authenticateWithBase({ redirectUrl: '/done' });
    void isomorphicClerk.authenticateWithSolana({ walletName: 'phantom' });
    expect(members.authenticateWithBase).not.toHaveBeenCalled();

    await loadedClerk(isomorphicClerk);

    expect(members.authenticateWithBase).toHaveBeenCalledWith({
      redirectUrl: '/done'
    });
    expect(members.authenticateWithSolana).toHaveBeenCalledWith({
      walletName: 'phantom'
    });
  });

  it("serves the signal stand-in until clerk-js loads, then clerk-js's state", async () => {
    const state = { signInSignal: vi.fn() };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, { __internal_state: state }) as any
    });
    const standIn = isomorphicClerk.__internal_state;
    expect(standIn).not.toBe(state);
    expect(standIn.signInSignal().signIn?.status).toBe('needs_identifier');
    // Its own waitlist, not a read of itself.
    expect(standIn.__internal_waitlist.id).toBe('');

    await loadedClerk(isomorphicClerk);

    expect(isomorphicClerk.__internal_state).toBe(state);
  });

  it('navigates the window itself, with the same allowlist, on a clerk-js without __internal_windowNavigate', async () => {
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      allowedRedirectProtocols: ['myapp:'],
      Clerk: clerkJS as any
    });
    await loadedClerk(isomorphicClerk);

    isomorphicClerk.__internal_windowNavigate('myapp://done');
    expect(navigation.windowNavigate).toHaveBeenLastCalledWith('myapp://done', {
      allowedProtocols: [...navigation.ALLOWED_PROTOCOLS, 'myapp:']
    });

    isomorphicClerk.__internal_windowNavigate('https://example.com', {
      useStaticAllowlistOnly: true
    });
    expect(navigation.windowNavigate).toHaveBeenLastCalledWith(
      'https://example.com',
      { allowedProtocols: navigation.ALLOWED_PROTOCOLS }
    );
  });

  it("uses clerk-js's __internal_windowNavigate when it has one", async () => {
    const windowNavigate = vi.fn();
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, {
        __internal_windowNavigate: windowNavigate
      }) as any
    });
    await loadedClerk(isomorphicClerk);

    isomorphicClerk.__internal_windowNavigate('/next', {
      useStaticAllowlistOnly: true
    });

    expect(windowNavigate).toHaveBeenCalledWith('/next', {
      useStaticAllowlistOnly: true
    });
    expect(navigation.windowNavigate).not.toHaveBeenCalled();
  });

  it('mounts session tasks called for before clerk-js loads, except one unmounted first', async () => {
    const members = {
      mountTaskChooseOrganization: vi.fn(),
      mountTaskResetPassword: vi.fn(),
      mountTaskSetupMFA: vi.fn()
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, members) as any
    });
    const [choose, reset, mfa] = [0, 1, 2].map(() =>
      document.createElement('div')
    );
    isomorphicClerk.mountTaskChooseOrganization(choose, {
      redirectUrlComplete: '/a'
    });
    isomorphicClerk.mountTaskResetPassword(reset, {
      redirectUrlComplete: '/b'
    });
    isomorphicClerk.mountTaskSetupMFA(mfa, { redirectUrlComplete: '/c' });
    isomorphicClerk.unmountTaskSetupMFA(mfa);

    await loadedClerk(isomorphicClerk);

    expect(members.mountTaskChooseOrganization).toHaveBeenCalledWith(choose, {
      redirectUrlComplete: '/a'
    });
    expect(members.mountTaskResetPassword).toHaveBeenCalledWith(reset, {
      redirectUrlComplete: '/b'
    });
    expect(members.mountTaskSetupMFA).not.toHaveBeenCalled();
  });

  it('queues the task redirect, the protect assertion and the resource callback until clerk-js loads', async () => {
    const assertion = { token: 'x' } as any;
    const members = {
      buildTasksUrl: vi.fn(() => '/tasks'),
      redirectToTasks: vi.fn(async () => undefined),
      setProtectAssertion: vi.fn(),
      __internal_handleResourceCallback: vi.fn(async () => 'handled')
    };
    const isomorphicClerk = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(clerkJS, members) as any
    });
    expect(isomorphicClerk.buildTasksUrl()).toBeUndefined();
    void isomorphicClerk.redirectToTasks({ redirectUrl: '/next' });
    isomorphicClerk.setProtectAssertion(assertion);
    const signIn = {} as any;
    void isomorphicClerk.__internal_handleResourceCallback(signIn, {});
    expect(members.redirectToTasks).not.toHaveBeenCalled();

    await loadedClerk(isomorphicClerk);

    expect(members.redirectToTasks).toHaveBeenCalledWith({
      redirectUrl: '/next'
    });
    expect(members.setProtectAssertion).toHaveBeenCalledWith(assertion);
    expect(members.__internal_handleResourceCallback).toHaveBeenCalledWith(
      signIn,
      {},
      undefined
    );
    expect(isomorphicClerk.buildTasksUrl()).toBe('/tasks');
  });

  it('resumes after a protect check on clerk-js, and does nothing on one without it', async () => {
    const resume = vi.fn(async () => undefined);
    const older = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: clerkJS as any
    });
    await loadedClerk(older);
    await expect(
      older.__internal_resumeAfterProtectCheck({} as any)
    ).resolves.toBeUndefined();
    await expect(
      older.__internal_resolvePendingProtectCheck('signIn')
    ).resolves.toBeUndefined();

    IsomorphicClerk.clearInstance();
    const fresh = createClerkJS();
    globalThis.Clerk = undefined;
    const current = new IsomorphicClerk({
      publishableKey: 'pk_test_XXX',
      Clerk: Object.assign(fresh, {
        __internal_resumeAfterProtectCheck: resume,
        __internal_protectChallengeLoadTimeoutMs: 5000
      }) as any
    });
    const navigate = vi.fn(async () => undefined);
    void current.__internal_resumeAfterProtectCheck(
      { flow: 'signIn' } as any,
      navigate
    );
    await loadedClerk(current);

    expect(resume).toHaveBeenCalledWith({ flow: 'signIn' }, navigate);
    expect(current.__internal_protectChallengeLoadTimeoutMs).toBe(5000);
  });
});
