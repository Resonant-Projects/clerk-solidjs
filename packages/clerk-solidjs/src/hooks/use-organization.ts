import { getCurrentOrganizationMembership } from '@clerk/shared/organization';
import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  GetDomainsParams,
  GetInvitationsParams,
  GetMembershipRequestParams,
  GetMembersParams,
  OrganizationDomainResource,
  OrganizationInvitationResource,
  OrganizationMembershipRequestResource,
  OrganizationMembershipResource
} from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useClerkInstanceContext } from '../contexts/clerk-instance';
import { useOrganizationContext } from '../contexts/organization';
import { useSessionContext } from '../contexts/session';
import { createCacheKeys, STABLE_KEYS } from '../query/keys';
import type { PaginatedHookConfig, PaginatedResources } from '../types';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { useAttemptToEnableOrganizations } from './use-attempt-to-enable-organizations';
import { createSafeValues, usePagesOrInfinite } from './use-pages-or-infinite';
import { recordTelemetryOnce } from './utils';

type UseOrganizationParams = {
  domains?: true | PaginatedHookConfig<GetDomainsParams>;
  membershipRequests?: true | PaginatedHookConfig<GetMembershipRequestParams>;
  memberships?: true | PaginatedHookConfig<GetMembersParams>;
  invitations?: true | PaginatedHookConfig<GetInvitationsParams>;
  /** @internal Skips the enable-organizations prompt, for Clerk's own components. */
  __internal_skipAttemptToEnableOrganizations?: boolean;
};

/**
 * The active organization, your membership in it, and paginated lists of its
 * domains, membership requests, memberships and invitations. Each list is
 * fetched only when its param is passed, as in @clerk/react.
 *
 * While Clerk loads, `isLoaded()` is `false` and every field is `undefined`.
 * With no active organization, `isLoaded()` is `true` and every field is
 * `null`.
 */
export const useOrganization = (params?: Accessor<UseOrganizationParams>) => {
  useAssertWrappedByClerkProvider('useOrganization');
  useAttemptToEnableOrganizations(
    'useOrganization',
    () => !params?.().__internal_skipAttemptToEnableOrganizations
  );

  const organization = useOrganizationContext();
  const session = useSessionContext();
  const clerk = useClerkInstanceContext();

  recordTelemetryOnce(clerk, () => eventMethodCalled('useOrganization'));

  const listParams =
    <K extends keyof UseOrganizationParams>(key: K) =>
    () =>
      params?.()[key];

  const domainSafeValues = createSafeValues(listParams('domains'), {
    initialPage: 1,
    pageSize: 10,
    keepPreviousData: false,
    infinite: false,
    enrollmentMode: undefined
  } as PaginatedHookConfig<GetDomainsParams>);

  const membershipRequestSafeValues = createSafeValues(
    listParams('membershipRequests'),
    {
      initialPage: 1,
      pageSize: 10,
      status: 'pending',
      keepPreviousData: false,
      infinite: false
    } as PaginatedHookConfig<GetMembershipRequestParams>
  );

  const membersSafeValues = createSafeValues(listParams('memberships'), {
    initialPage: 1,
    pageSize: 10,
    role: undefined,
    keepPreviousData: false,
    infinite: false,
    query: undefined
  } as PaginatedHookConfig<GetMembersParams>);

  const invitationsSafeValues = createSafeValues(listParams('invitations'), {
    initialPage: 1,
    pageSize: 10,
    status: ['pending'],
    keepPreviousData: false,
    infinite: false
  } as PaginatedHookConfig<GetInvitationsParams>);

  const domainParams = createMemo((): GetDomainsParams | undefined =>
    listParams('domains')() === undefined
      ? undefined
      : {
          initialPage: domainSafeValues().initialPage,
          pageSize: domainSafeValues().pageSize,
          enrollmentMode: domainSafeValues().enrollmentMode
        }
  );

  const membershipRequestParams = createMemo(
    (): GetMembershipRequestParams | undefined =>
      listParams('membershipRequests')() === undefined
        ? undefined
        : {
            initialPage: membershipRequestSafeValues().initialPage,
            pageSize: membershipRequestSafeValues().pageSize,
            status: membershipRequestSafeValues().status
          }
  );

  const membersParams = createMemo((): GetMembersParams | undefined =>
    listParams('memberships')() === undefined
      ? undefined
      : {
          initialPage: membersSafeValues().initialPage,
          pageSize: membersSafeValues().pageSize,
          role: membersSafeValues().role,
          query: membersSafeValues().query
        }
  );

  const invitationsParams = createMemo((): GetInvitationsParams | undefined =>
    listParams('invitations')() === undefined
      ? undefined
      : {
          initialPage: invitationsSafeValues().initialPage,
          pageSize: invitationsSafeValues().pageSize,
          status: invitationsSafeValues().status
        }
  );

  const domains = usePagesOrInfinite<
    GetDomainsParams,
    OrganizationDomainResource
  >(() => ({
    fetcher: organization()?.getDomains,
    config: {
      keepPreviousData: domainSafeValues().keepPreviousData,
      infinite: domainSafeValues().infinite,
      enabled: !!domainParams(),
      isSignedIn: organization() !== null,
      initialPage: domainSafeValues().initialPage,
      pageSize: domainSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.DOMAINS_KEY,
      authenticated: true,
      tracked: { organizationId: organization()?.id },
      untracked: { args: domainParams() }
    })
  }));

  const membershipRequests = usePagesOrInfinite<
    GetMembershipRequestParams,
    OrganizationMembershipRequestResource
  >(() => ({
    fetcher: organization()?.getMembershipRequests,
    config: {
      keepPreviousData: membershipRequestSafeValues().keepPreviousData,
      infinite: membershipRequestSafeValues().infinite,
      enabled: !!membershipRequestParams(),
      isSignedIn: organization() !== null,
      initialPage: membershipRequestSafeValues().initialPage,
      pageSize: membershipRequestSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.MEMBERSHIP_REQUESTS_KEY,
      authenticated: true,
      tracked: { organizationId: organization()?.id },
      untracked: { args: membershipRequestParams() }
    })
  }));

  const memberships = usePagesOrInfinite<
    GetMembersParams,
    OrganizationMembershipResource
  >(() => ({
    fetcher: organization()?.getMemberships,
    config: {
      keepPreviousData: membersSafeValues().keepPreviousData,
      infinite: membersSafeValues().infinite,
      enabled: !!membersParams(),
      isSignedIn: organization() !== null,
      initialPage: membersSafeValues().initialPage,
      pageSize: membersSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.MEMBERSHIPS_KEY,
      authenticated: true,
      tracked: { organizationId: organization()?.id },
      untracked: { args: membersParams() }
    })
  }));

  const invitations = usePagesOrInfinite<
    GetInvitationsParams,
    OrganizationInvitationResource
  >(() => ({
    fetcher: organization()?.getInvitations,
    config: {
      keepPreviousData: invitationsSafeValues().keepPreviousData,
      infinite: invitationsSafeValues().infinite,
      enabled: !!invitationsParams(),
      isSignedIn: organization() !== null,
      initialPage: invitationsSafeValues().initialPage,
      pageSize: invitationsSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.INVITATIONS_KEY,
      authenticated: true,
      tracked: { organizationId: organization()?.id },
      untracked: { args: invitationsParams() }
    })
  }));

  // The four states of @clerk/shared's useOrganization: Clerk still loading,
  // no active organization, an organization rendered on the server before
  // clerk-js loads, and loaded.
  const state = createMemo(() => {
    const org = organization();
    if (org === undefined) return 'loading';
    if (org === null) return 'none';
    return clerk().loaded ? 'ready' : 'ssr';
  });

  const isLoaded = createMemo(() => state() !== 'loading');

  const list = <T>(resources: PaginatedResources<T>) =>
    createMemo(() => {
      switch (state()) {
        case 'none':
          return null;
        case 'ready':
          return resources;
        default:
          return undefined;
      }
    });

  const membership = createMemo(() => {
    switch (state()) {
      case 'none':
        return null;
      case 'ready':
        return getCurrentOrganizationMembership(
          session()?.user?.organizationMemberships ?? [],
          organization()!.id
        );
      default:
        return undefined;
    }
  });

  return {
    isLoaded,
    organization,
    membership,
    domains: list(domains),
    membershipRequests: list(membershipRequests),
    memberships: list(memberships),
    invitations: list(invitations)
  };
};
