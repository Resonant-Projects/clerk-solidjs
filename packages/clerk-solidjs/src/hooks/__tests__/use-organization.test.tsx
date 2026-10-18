import type {
  OrganizationMembershipResource,
  OrganizationResource,
  SignedInSessionResource,
  UserResource
} from '@clerk/shared/types';
import { cleanup, render } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/query-core';
import { createSignal, type JSX, Show } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider, useOrganization, useOrganizationList } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';
import {
  __setClerkQueryClientForTest,
  getClerkQueryClient
} from '../../query/clerk-query-client';

type Page<T> = { data: T[]; total_count: number };

/** A fetcher over `total` numbered items that honours initialPage/pageSize. */
const pagedFetcher = (total: number, prefix = 'item') =>
  vi.fn(
    async (args?: {
      initialPage?: number;
      pageSize?: number;
    }): Promise<Page<{ id: string }>> => {
      const page = args?.initialPage ?? 1;
      const size = args?.pageSize ?? 10;
      const start = (page - 1) * size;
      const data = Array.from(
        { length: Math.max(0, Math.min(size, total - start)) },
        (_, i) => ({ id: `${prefix}_${start + i + 1}` })
      );
      return { data, total_count: total };
    }
  );

const buildOrganization = (getMemberships = pagedFetcher(25, 'mem')) =>
  ({
    id: 'org_1',
    getMemberships,
    getDomains: pagedFetcher(0),
    getInvitations: pagedFetcher(0),
    getMembershipRequests: pagedFetcher(0)
  }) as unknown as OrganizationResource;

const buildUser = (getOrganizationMemberships = pagedFetcher(3, 'om')) =>
  ({
    id: 'user_1',
    organizationMemberships: [
      {
        id: 'orgmem_1',
        role: 'org:admin',
        permissions: [],
        organization: { id: 'org_1' }
      } as unknown as OrganizationMembershipResource
    ],
    getOrganizationMemberships,
    getOrganizationInvitations: pagedFetcher(0),
    getOrganizationSuggestions: pagedFetcher(0)
  }) as unknown as UserResource;

const buildSession = (user: UserResource) =>
  ({
    id: 'sess_1',
    status: 'active',
    user,
    lastActiveToken: { jwt: { claims: {} } }
  }) as unknown as SignedInSessionResource;

const renderInProvider = (
  clerkJS: ReturnType<typeof createFakeClerkJS>['clerkJS'],
  ui: () => JSX.Element
) =>
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

const signedInFixtures = (getMemberships = pagedFetcher(25, 'mem')) => {
  const user = buildUser();
  const organization = buildOrganization(getMemberships);
  return { user, organization, session: buildSession(user) };
};

describe('useOrganization', () => {
  it('reports loading, then the organization and my membership', async () => {
    const { clerkJS } = createFakeClerkJS(signedInFixtures());
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization();
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    expect(result.isLoaded()).toBe(false);
    expect(result.membership()).toBeUndefined();

    await vi.waitFor(() => expect(result.isLoaded()).toBe(true));
    expect(result.organization()?.id).toBe('org_1');
    expect(result.membership()?.id).toBe('orgmem_1');
    // No list was requested, so none is fetched.
    expect(result.memberships()?.data()).toEqual([]);
  });

  it('is loaded with null fields when there is no active organization', async () => {
    const user = buildUser();
    const { clerkJS } = createFakeClerkJS({
      user,
      session: buildSession(user),
      organization: null
    });
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(result.isLoaded()).toBe(true));
    expect(result.organization()).toBeNull();
    expect(result.membership()).toBeNull();
    expect(result.memberships()).toBeNull();
  });

  it('fetches paginated memberships and moves between pages', async () => {
    const getMemberships = pagedFetcher(25, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: { pageSize: 10 } }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const memberships = result.memberships()!;
    expect(memberships.count()).toBe(25);
    expect(memberships.page()).toBe(1);
    expect(memberships.pageCount()).toBe(3);
    expect(memberships.hasNextPage()).toBe(true);
    expect(memberships.hasPreviousPage()).toBe(false);
    expect(getMemberships).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialPage: 1, pageSize: 10 })
    );

    memberships.fetchNext();
    await vi.waitFor(() =>
      expect(memberships.data()[0]).toEqual({ id: 'mem_11' })
    );
    expect(memberships.page()).toBe(2);
    expect(memberships.hasPreviousPage()).toBe(true);

    memberships.fetchPage(3);
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(5));
    expect(memberships.hasNextPage()).toBe(false);
  });

  it('accumulates pages in infinite mode', async () => {
    const getMemberships = pagedFetcher(25, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({
        memberships: { pageSize: 10, infinite: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const memberships = result.memberships()!;
    expect(memberships.hasNextPage()).toBe(true);

    memberships.fetchNext();
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(20));
    expect(memberships.page()).toBe(2);
    expect(memberships.data()[10]).toEqual({ id: 'mem_11' });

    memberships.fetchNext();
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(25));
    expect(memberships.hasNextPage()).toBe(false);
    expect(
      getMemberships.mock.calls.map(([args]) => args?.initialPage)
    ).toEqual([1, 2, 3]);
  });

  it('reports the next page correctly when the list starts after page 1', async () => {
    const getMemberships = pagedFetcher(50, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({
        memberships: { initialPage: 3, pageSize: 10 }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()[0]).toEqual({ id: 'mem_21' })
    );
    const memberships = result.memberships()!;
    // Items 21–30 of 50: pages 4 and 5 remain.
    expect(memberships.page()).toBe(3);
    expect(memberships.hasNextPage()).toBe(true);
    expect(memberships.hasPreviousPage()).toBe(false);
    expect(memberships.pageCount()).toBe(3);

    memberships.fetchNext();
    await vi.waitFor(() =>
      expect(memberships.data()[0]).toEqual({ id: 'mem_31' })
    );
    expect(memberships.hasNextPage()).toBe(true);

    memberships.fetchNext();
    await vi.waitFor(() =>
      expect(memberships.data()[0]).toEqual({ id: 'mem_41' })
    );
    expect(memberships.hasNextPage()).toBe(false);
    expect(memberships.hasPreviousPage()).toBe(true);
  });

  it('loads every page up to the one fetchPage asks for on an infinite list', async () => {
    const getMemberships = pagedFetcher(25, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({
        memberships: { pageSize: 5, infinite: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(5)
    );
    const memberships = result.memberships()!;

    memberships.fetchPage(4);
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(20));
    expect(memberships.page()).toBe(4);

    // Past the end, it stops at the last page.
    memberships.fetchPage(10);
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(25));
    expect(memberships.hasNextPage()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      getMemberships.mock.calls.map(([args]) => args?.initialPage)
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('leaves an infinite list unchanged when setData gets undefined', async () => {
    const { clerkJS } = createFakeClerkJS(signedInFixtures());
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({
        memberships: { pageSize: 10, infinite: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const memberships = result.memberships()!;

    await memberships.setData(undefined);
    await memberships.setData(() => undefined);
    expect(memberships.data()).toHaveLength(10);
    expect(memberships.hasNextPage()).toBe(true);

    memberships.fetchNext();
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(20));
  });

  it('accepts setData on an infinite list before its first fetch finishes', async () => {
    const pending = vi.fn(() => new Promise<never>(() => {}));
    const { clerkJS } = createFakeClerkJS(signedInFixtures(pending as any));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({
        memberships: { pageSize: 10, infinite: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(pending).toHaveBeenCalled());
    const memberships = result.memberships()!;

    await memberships.setData([
      {
        data: [{ id: 'seeded' } as unknown as OrganizationMembershipResource],
        total_count: 25
      }
    ] as any);

    await vi.waitFor(() =>
      expect(memberships.data()).toEqual([{ id: 'seeded' }])
    );
    // The observer reports the seeded page, with its page param, a tick later.
    await vi.waitFor(() => expect(memberships.hasNextPage()).toBe(true));
  });

  it('writes setData to the cache and refetches on revalidate', async () => {
    const getMemberships = pagedFetcher(3, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(3)
    );
    const memberships = result.memberships()!;

    await memberships.setData((previous) => ({
      data: previous!.data.slice(0, 1),
      total_count: 1
    }));
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(1));
    expect(memberships.count()).toBe(1);

    const callsBefore = getMemberships.mock.calls.length;
    await memberships.revalidate();
    await vi.waitFor(() => expect(memberships.data()).toHaveLength(3));
    expect(getMemberships.mock.calls.length).toBe(callsBefore + 1);
  });

  it('keeps the page it moved to while an earlier cache write is delivered', async () => {
    const getMemberships = pagedFetcher(25, 'mem');
    const { clerkJS } = createFakeClerkJS(signedInFixtures(getMemberships));
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: { pageSize: 10 } }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const memberships = result.memberships()!;
    memberships.fetchNext();
    await vi.waitFor(() =>
      expect(memberships.data()[0]).toEqual({ id: 'mem_11' })
    );
    memberships.fetchPrevious();
    await vi.waitFor(() =>
      expect(memberships.data()[0]).toEqual({ id: 'mem_1' })
    );

    // Write page 1, then move to the cached page 2 before the write's
    // notification is delivered.
    void memberships.setData((previous) => ({
      ...previous!,
      data: [{ id: 'edited' } as unknown as OrganizationMembershipResource]
    }));
    memberships.fetchPage(2);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(memberships.page()).toBe(2);
    expect(memberships.data()[0]).toEqual({ id: 'mem_11' });
  });

  it('shows a list another hook fetched, even where it was not requested', async () => {
    const { clerkJS } = createFakeClerkJS(signedInFixtures());
    let passive!: ReturnType<typeof useOrganization>;
    let active!: ReturnType<typeof useOrganization>;
    const Passive = () => {
      passive = useOrganization();
      return null;
    };
    const Active = () => {
      active = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => (
      <>
        <Passive />
        <Active />
      </>
    ));
    await vi.waitFor(() =>
      expect(active.memberships()?.data()).toHaveLength(10)
    );
    await vi.waitFor(() =>
      expect(passive.memberships()?.data()).toHaveLength(10)
    );
  });

  it('surfaces a fetch error', async () => {
    const getMemberships = vi.fn(async () => {
      throw new Error('boom');
    });
    const { clerkJS } = createFakeClerkJS(
      signedInFixtures(getMemberships as any)
    );
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() => expect(result.memberships()?.isError()).toBe(true));
    expect(result.memberships()?.error()?.message).toBe('boom');
    expect(result.memberships()?.data()).toEqual([]);
  });

  it('clears cached lists when the organization goes away', async () => {
    const { clerkJS, emit } = createFakeClerkJS(signedInFixtures());
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const cache = getClerkQueryClient()!.getQueryCache();
    expect(cache.findAll({ queryKey: ['memberships'] }).length).toBeGreaterThan(
      0
    );

    emit({ organization: null });

    await vi.waitFor(() => expect(result.memberships()).toBeNull());
    expect(cache.findAll({ queryKey: ['memberships'] })).toHaveLength(0);
  });
});

describe('sign-out', () => {
  it('clears cached lists even after their hooks have unmounted', async () => {
    const { clerkJS, emit } = createFakeClerkJS(signedInFixtures());
    const [showList, setShowList] = createSignal(true);
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => (
      <Show when={showList()}>
        <Probe />
      </Show>
    ));
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const cache = getClerkQueryClient()!.getQueryCache();
    const membershipQueries = () =>
      cache.findAll({ queryKey: ['memberships'] }).length;
    expect(membershipQueries()).toBeGreaterThan(0);

    // Navigate away from the list, then sign out.
    setShowList(false);
    emit({ user: null, session: null, organization: null });

    await vi.waitFor(() => expect(membershipQueries()).toBe(0));
  });

  it("clears cached lists when sign-out passes through clerk-js's transitive state", async () => {
    const { clerkJS, emit } = createFakeClerkJS(signedInFixtures());
    const [showList, setShowList] = createSignal(true);
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization(() => ({ memberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => (
      <Show when={showList()}>
        <Probe />
      </Show>
    ));
    await vi.waitFor(() =>
      expect(result.memberships()?.data()).toHaveLength(10)
    );
    const cache = getClerkQueryClient()!.getQueryCache();
    const membershipQueries = () =>
      cache.findAll({ queryKey: ['memberships'] }).length;
    setShowList(false);

    // signOut() empties the resources first, then emits the signed-out state.
    emit({ user: undefined, session: undefined, organization: undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(membershipQueries()).toBeGreaterThan(0);
    emit({ user: null, session: null, organization: null });

    await vi.waitFor(() => expect(membershipQueries()).toBe(0));
  });
});

describe('keepPreviousData across users', () => {
  it("never shows the previous user's list while the next user's first page loads", async () => {
    const userA = buildUser(pagedFetcher(3, 'a'));
    const userB = {
      ...buildUser(vi.fn(() => new Promise<never>(() => {})) as any),
      id: 'user_2'
    } as UserResource;
    const { clerkJS, emit } = createFakeClerkJS({
      user: userA,
      session: buildSession(userA),
      organization: null
    });
    let result!: ReturnType<typeof useOrganizationList>;
    const Probe = () => {
      result = useOrganizationList(() => ({
        userMemberships: { keepPreviousData: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.userMemberships()?.data()).toHaveLength(3)
    );

    // A signs out and B signs in, with the hook mounted the whole time.
    emit({ user: null, session: null });
    await vi.waitFor(() => expect(result.userMemberships()).toBeUndefined());
    emit({ user: userB, session: buildSession(userB) });
    await vi.waitFor(() => expect(result.userMemberships()).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.userMemberships()?.data()).toEqual([]);
  });

  it('keeps the previous page for the same user while the next one loads', async () => {
    let resolveSecond!: (value: Page<{ id: string }>) => void;
    const getOrganizationMemberships = vi.fn(
      async (args?: { initialPage?: number }) =>
        (args?.initialPage ?? 1) === 1
          ? { data: [{ id: 'om_1' }], total_count: 2 }
          : new Promise<Page<{ id: string }>>((resolve) => {
              resolveSecond = resolve;
            })
    );
    const user = buildUser(getOrganizationMemberships as any);
    const { clerkJS } = createFakeClerkJS({
      user,
      session: buildSession(user),
      organization: null
    });
    let result!: ReturnType<typeof useOrganizationList>;
    const Probe = () => {
      result = useOrganizationList(() => ({
        userMemberships: { pageSize: 1, keepPreviousData: true }
      }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    await vi.waitFor(() =>
      expect(result.userMemberships()?.data()).toEqual([{ id: 'om_1' }])
    );
    result.userMemberships()!.fetchNext();
    await vi.waitFor(() =>
      expect(getOrganizationMemberships).toHaveBeenCalledTimes(2)
    );
    // Page 2 is still loading, so page 1 stays on screen.
    expect(result.userMemberships()?.data()).toEqual([{ id: 'om_1' }]);
    resolveSecond({ data: [{ id: 'om_2' }], total_count: 2 });
    await vi.waitFor(() =>
      expect(result.userMemberships()?.data()).toEqual([{ id: 'om_2' }])
    );
  });
});

describe('useOrganizationList', () => {
  it('fetches the user memberships once Clerk has a user', async () => {
    const getOrganizationMemberships = pagedFetcher(3, 'om');
    const user = buildUser(getOrganizationMemberships);
    const { clerkJS } = createFakeClerkJS({
      user,
      session: buildSession(user),
      organization: null
    });
    let result!: ReturnType<typeof useOrganizationList>;
    const Probe = () => {
      result = useOrganizationList(() => ({ userMemberships: true }));
      return null;
    };

    renderInProvider(clerkJS, () => <Probe />);
    expect(result.isLoaded()).toBe(false);
    expect(result.userMemberships()).toBeUndefined();

    await vi.waitFor(() =>
      expect(result.userMemberships()?.data()).toHaveLength(3)
    );
    expect(result.isLoaded()).toBe(true);
    expect(result.userMemberships()?.count()).toBe(3);
    expect(getOrganizationMemberships).toHaveBeenCalledTimes(1);
  });
});
