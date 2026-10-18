import type { UserResource } from '@clerk/shared/types';
import { cleanup, render } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/query-core';
import { createSignal, type JSX } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  useAPIKeys,
  useOAuthConsent,
  useOAuthDeviceVerification,
  useOrganization,
  useOrganizationCreationDefaults,
  useOrganizationList
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';
import {
  __setClerkQueryClientForTest,
  getClerkQueryClient
} from '../../query/clerk-query-client';

const signedInUser = (fields: Record<string, unknown> = {}) =>
  ({
    id: 'user_1',
    organizationMemberships: [],
    getOrganizationMemberships: vi.fn(async () => ({
      data: [],
      total_count: 0
    })),
    getOrganizationInvitations: vi.fn(async () => ({
      data: [],
      total_count: 0
    })),
    getOrganizationSuggestions: vi.fn(async () => ({
      data: [],
      total_count: 0
    })),
    ...fields
  }) as unknown as UserResource;

const setup = (members: Record<string, unknown>, user = signedInUser()) => {
  const { clerkJS } = createFakeClerkJS({
    user,
    session: {
      id: 'sess_1',
      status: 'active',
      user,
      lastActiveToken: { jwt: { claims: {} } }
    } as any
  });
  return Object.assign(clerkJS, members) as any;
};

const renderInProvider = (clerkJS: unknown, ui: () => JSX.Element) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

beforeEach(() => {
  __setClerkQueryClientForTest(
    new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
});

afterEach(() => {
  cleanup();
  __setClerkQueryClientForTest(undefined);
});

describe('useAPIKeys', () => {
  it("pages through the subject's API keys once Clerk loads", async () => {
    const getAll = vi.fn(async (args: any) => ({
      data: [{ id: `key_${args.initialPage}`, name: 'CI' }],
      total_count: 12
    }));
    const clerkJS = setup({ apiKeys: { getAll } });
    let keys!: ReturnType<typeof useAPIKeys>;
    renderInProvider(clerkJS, () => {
      keys = useAPIKeys(() => ({ subject: 'org_1', pageSize: 10 }));
      return null;
    });

    await vi.waitFor(() =>
      expect(keys.data()).toEqual([{ id: 'key_1', name: 'CI' }])
    );
    expect(getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'org_1',
        initialPage: 1,
        pageSize: 10
      })
    );
    expect(keys.count()).toBe(12);
    expect(keys.pageCount()).toBe(2);
  });

  it('fetches nothing while disabled', async () => {
    const getAll = vi.fn();
    const clerkJS = setup({ apiKeys: { getAll } });
    renderInProvider(clerkJS, () => {
      useAPIKeys(() => ({ enabled: false }));
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getAll).not.toHaveBeenCalled();
  });
});

describe('useAPIKeys subjects', () => {
  it("refetches a cached list with its own subject, not the hook's current one", async () => {
    const getAll = vi.fn(async (args: any) => ({
      data: [{ id: `${args.subject}_${args.initialPage}` }],
      total_count: 4
    }));
    const clerkJS = setup({ apiKeys: { getAll } });
    const [subject, setSubject] = createSignal('org_a');
    let keys!: ReturnType<typeof useAPIKeys>;
    renderInProvider(clerkJS, () => {
      keys = useAPIKeys(() => ({
        subject: subject(),
        infinite: true,
        pageSize: 1
      }));
      return null;
    });
    await vi.waitFor(() => expect(keys.data()).toHaveLength(1));
    keys.fetchNext();
    await vi.waitFor(() => expect(keys.data()).toHaveLength(2));

    setSubject('org_b');
    await vi.waitFor(() => expect(keys.data()?.[0]?.id).toBe('org_b_1'));
    getAll.mockClear();
    // org_a's list, still cached, refetches both of its pages.
    await getClerkQueryClient()!.refetchQueries({ type: 'all' });

    const subjects = getAll.mock.calls.map(([args]) => args.subject);
    expect(subjects.filter((value) => value === 'org_a')).toHaveLength(2);
  });
});

describe('previous data across accounts', () => {
  it("does not show the previous user's consent info to the next user", async () => {
    let finishSecond!: (info: unknown) => void;
    const getConsentInfo = vi
      .fn()
      .mockResolvedValueOnce({ oauthApplicationName: 'For user 1' })
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishSecond = resolve))
      );
    const { clerkJS, emit } = (() => {
      const fake = createFakeClerkJS({
        user: signedInUser(),
        session: {
          id: 'sess_1',
          status: 'active',
          user: signedInUser(),
          lastActiveToken: { jwt: { claims: {} } }
        } as any
      });
      Object.assign(fake.clerkJS, { oauthApplication: { getConsentInfo } });
      return fake;
    })();
    let consent!: ReturnType<typeof useOAuthConsent>;
    renderInProvider(clerkJS, () => {
      consent = useOAuthConsent(() => ({ oauthClientId: 'client_a' }));
      return null;
    });
    await vi.waitFor(() =>
      expect(consent.data()?.oauthApplicationName).toBe('For user 1')
    );

    const nextUser = signedInUser({ id: 'user_2' });
    emit({
      user: nextUser,
      session: {
        id: 'sess_2',
        status: 'active',
        user: nextUser,
        lastActiveToken: { jwt: { claims: {} } }
      } as any
    });
    await vi.waitFor(() => expect(getConsentInfo).toHaveBeenCalledTimes(2));
    expect(consent.data()).toBeUndefined();

    finishSecond({ oauthApplicationName: 'For user 2' });
    await vi.waitFor(() =>
      expect(consent.data()?.oauthApplicationName).toBe('For user 2')
    );
  });
});

describe('useOAuthConsent', () => {
  it('fetches the consent info for a client, and follows its params', async () => {
    const getConsentInfo = vi.fn(async ({ oauthClientId }: any) => ({
      oauthApplicationName: `App ${oauthClientId}`
    }));
    const clerkJS = setup({ oauthApplication: { getConsentInfo } });
    const [clientId, setClientId] = createSignal('  client_a  ');
    let consent!: ReturnType<typeof useOAuthConsent>;
    renderInProvider(clerkJS, () => {
      consent = useOAuthConsent(() => ({
        oauthClientId: clientId(),
        scope: 'openid'
      }));
      return null;
    });

    await vi.waitFor(() =>
      expect(consent.data()?.oauthApplicationName).toBe('App client_a')
    );
    expect(getConsentInfo).toHaveBeenCalledWith({
      oauthClientId: 'client_a',
      scope: 'openid'
    });

    setClientId('client_b');
    await vi.waitFor(() =>
      expect(consent.data()?.oauthApplicationName).toBe('App client_b')
    );
  });

  it('fetches nothing without a client id', async () => {
    const getConsentInfo = vi.fn();
    const clerkJS = setup({ oauthApplication: { getConsentInfo } });
    let consent!: ReturnType<typeof useOAuthConsent>;
    renderInProvider(clerkJS, () => {
      consent = useOAuthConsent(() => ({ oauthClientId: '   ' }));
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getConsentInfo).not.toHaveBeenCalled();
    expect(consent.data()).toBeUndefined();
  });
});

describe('useOAuthDeviceVerification', () => {
  const deviceApplication = () => {
    let finishLookup!: (info: unknown) => void;
    const lookupDeviceVerification = vi.fn(
      () => new Promise((resolve) => (finishLookup = resolve))
    );
    const submitDeviceVerification = vi.fn(async ({ approved }: any) => ({
      status: approved ? 'approved' : 'denied'
    }));
    return {
      application: { lookupDeviceVerification, submitDeviceVerification },
      finishLookup: (info: unknown) => finishLookup(info)
    };
  };

  it('looks a normalized code up once, rejects another meanwhile, then approves it', async () => {
    const { application, finishLookup } = deviceApplication();
    const clerkJS = setup({ oauthApplication: application });
    let device!: ReturnType<typeof useOAuthDeviceVerification>;
    renderInProvider(clerkJS, () => {
      device = useOAuthDeviceVerification();
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

    const first = device.lookup({ userCode: 'abcd-efgh' });
    expect(device.lookup({ userCode: 'ABCD EFGH' })).toBe(first);
    await expect(device.lookup({ userCode: 'other' })).rejects.toMatchObject({
      code: 'oauth_device_verification_lookup_in_progress'
    });
    expect(device.isLoading()).toBe(true);
    expect(application.lookupDeviceVerification).toHaveBeenCalledWith({
      userCode: 'ABCDEFGH'
    });

    finishLookup({ oauthApplicationName: 'TV app' });
    await expect(first).resolves.toEqual({ oauthApplicationName: 'TV app' });
    expect(device.data()).toEqual({ oauthApplicationName: 'TV app' });
    expect(device.isLoading()).toBe(false);

    await expect(device.approve({ userCode: 'abcd-efgh' })).resolves.toEqual({
      status: 'approved'
    });
    expect(application.submitDeviceVerification).toHaveBeenCalledWith({
      userCode: 'ABCDEFGH',
      approved: true
    });
    expect(device.result()).toEqual({ status: 'approved' });
  });

  it('ignores a lookup that finishes after reset', async () => {
    const { application, finishLookup } = deviceApplication();
    const clerkJS = setup({ oauthApplication: application });
    let device!: ReturnType<typeof useOAuthDeviceVerification>;
    renderInProvider(clerkJS, () => {
      device = useOAuthDeviceVerification();
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

    const stale = device.lookup({ userCode: 'AAAA' });
    device.reset();
    finishLookup({ oauthApplicationName: 'stale' });
    await stale;
    expect(device.data()).toBeUndefined();
    expect(device.isLoading()).toBe(false);
  });

  it('rejects before Clerk has loaded', async () => {
    const { application } = deviceApplication();
    const { clerkJS } = createFakeClerkJS();
    clerkJS.load.mockImplementation(() => new Promise(() => {}));
    Object.assign(clerkJS, { oauthApplication: application });
    let device!: ReturnType<typeof useOAuthDeviceVerification>;
    renderInProvider(clerkJS, () => {
      device = useOAuthDeviceVerification();
      return null;
    });

    await expect(device.lookup({ userCode: 'AAAA' })).rejects.toMatchObject({
      code: 'oauth_device_verification_not_ready'
    });
  });
});

describe('useOrganizationCreationDefaults', () => {
  const environment = (enabled: boolean) => ({
    __internal_environment: {
      organizationSettings: { organizationCreationDefaults: { enabled } }
    }
  });

  it("returns the user's defaults when the instance has them turned on", async () => {
    const getOrganizationCreationDefaults = vi.fn(async () => ({
      form: { name: 'Acme' }
    }));
    const clerkJS = setup(
      environment(true),
      signedInUser({ getOrganizationCreationDefaults })
    );
    let defaults!: ReturnType<typeof useOrganizationCreationDefaults>;
    renderInProvider(clerkJS, () => {
      defaults = useOrganizationCreationDefaults();
      return null;
    });

    await vi.waitFor(() =>
      expect(defaults.data()).toEqual({ form: { name: 'Acme' } })
    );
  });

  it('fetches nothing when they are turned off', async () => {
    const getOrganizationCreationDefaults = vi.fn();
    const clerkJS = setup(
      environment(false),
      signedInUser({ getOrganizationCreationDefaults })
    );
    renderInProvider(clerkJS, () => {
      useOrganizationCreationDefaults();
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.load).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getOrganizationCreationDefaults).not.toHaveBeenCalled();
  });
});

describe('the enable-organizations prompt', () => {
  const askedBy = async (ui: () => void) => {
    const attempt = vi.fn();
    const clerkJS = setup({
      __internal_attemptToEnableEnvironmentSetting: attempt
    });
    renderInProvider(clerkJS, () => {
      ui();
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));
    await Promise.resolve();
    return attempt.mock.calls.map(([options]) => options);
  };

  it('is asked for by useOrganization', async () => {
    expect(await askedBy(() => useOrganization())).toEqual([
      { for: 'organizations', caller: 'useOrganization' }
    ]);
  });

  it('is asked for by useOrganizationList only when it lists something', async () => {
    expect(await askedBy(() => useOrganizationList())).toEqual([]);
    cleanup();
    expect(
      await askedBy(() =>
        useOrganizationList(() => ({ userMemberships: true }))
      )
    ).toEqual([{ for: 'organizations', caller: 'useOrganizationList' }]);
  });

  it("is not asked for by Clerk's own components, which skip it", async () => {
    expect(
      await askedBy(() =>
        useOrganization(() => ({
          __internal_skipAttemptToEnableOrganizations: true
        }))
      )
    ).toEqual([]);
  });
});
