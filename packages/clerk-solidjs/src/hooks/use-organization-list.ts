import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  GetUserOrganizationInvitationsParams,
  GetUserOrganizationMembershipParams,
  GetUserOrganizationSuggestionsParams,
  OrganizationMembershipResource,
  OrganizationSuggestionResource,
  UserOrganizationInvitationResource
} from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useClerkInstanceContext } from '../contexts/clerk-instance';
import { useUserContext } from '../contexts/user';
import { IsomorphicClerk } from '../isomorphic-clerk';
import { createCacheKeys, STABLE_KEYS } from '../query/keys';
import type { PaginatedHookConfig } from '../types';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { useAttemptToEnableOrganizations } from './use-attempt-to-enable-organizations';
import { createSafeValues, usePagesOrInfinite } from './use-pages-or-infinite';
import { recordTelemetryOnce } from './utils';

type UseOrganizationListParams = {
  userMemberships?:
    true | PaginatedHookConfig<GetUserOrganizationMembershipParams>;
  userInvitations?:
    true | PaginatedHookConfig<GetUserOrganizationInvitationsParams>;
  userSuggestions?:
    true | PaginatedHookConfig<GetUserOrganizationSuggestionsParams>;
};

/**
 * The signed-in user's organization memberships, invitations and suggestions,
 * each fetched only when its param is passed, plus `createOrganization` and
 * `setActive`. The lists are `undefined` until Clerk has loaded a user.
 */
export const useOrganizationList = (
  params?: Accessor<UseOrganizationListParams>
) => {
  useAssertWrappedByClerkProvider('useOrganizationList');
  // A call without list params is not using organizations; the prompt is for
  // the lists.
  useAttemptToEnableOrganizations('useOrganizationList', () => {
    const current = params?.();
    return (
      current?.userMemberships !== undefined ||
      current?.userInvitations !== undefined ||
      current?.userSuggestions !== undefined
    );
  });

  const clerk = useClerkInstanceContext();
  const user = useUserContext();

  recordTelemetryOnce(clerk, () => eventMethodCalled('useOrganizationList'));

  const listParams =
    <K extends keyof UseOrganizationListParams>(key: K) =>
    () =>
      params?.()[key];

  const userMembershipsSafeValues = createSafeValues(
    listParams('userMemberships'),
    {
      initialPage: 1,
      pageSize: 10,
      keepPreviousData: false,
      infinite: false
    } as PaginatedHookConfig<GetUserOrganizationMembershipParams>
  );

  const userInvitationsSafeValues = createSafeValues(
    listParams('userInvitations'),
    {
      initialPage: 1,
      pageSize: 10,
      status: 'pending',
      keepPreviousData: false,
      infinite: false
    } as PaginatedHookConfig<GetUserOrganizationInvitationsParams>
  );

  const userSuggestionsSafeValues = createSafeValues(
    listParams('userSuggestions'),
    {
      initialPage: 1,
      pageSize: 10,
      status: 'pending',
      keepPreviousData: false,
      infinite: false
    } as PaginatedHookConfig<GetUserOrganizationSuggestionsParams>
  );

  const userMembershipsParams = createMemo(
    (): GetUserOrganizationMembershipParams | undefined =>
      listParams('userMemberships')() === undefined
        ? undefined
        : {
            initialPage: userMembershipsSafeValues().initialPage,
            pageSize: userMembershipsSafeValues().pageSize
          }
  );

  const userInvitationsParams = createMemo(
    (): GetUserOrganizationInvitationsParams | undefined =>
      listParams('userInvitations')() === undefined
        ? undefined
        : {
            initialPage: userInvitationsSafeValues().initialPage,
            pageSize: userInvitationsSafeValues().pageSize,
            status: userInvitationsSafeValues().status
          }
  );

  const userSuggestionsParams = createMemo(
    (): GetUserOrganizationSuggestionsParams | undefined =>
      listParams('userSuggestions')() === undefined
        ? undefined
        : {
            initialPage: userSuggestionsSafeValues().initialPage,
            pageSize: userSuggestionsSafeValues().pageSize,
            status: userSuggestionsSafeValues().status
          }
  );

  const memberships = usePagesOrInfinite<
    GetUserOrganizationMembershipParams,
    OrganizationMembershipResource
  >(() => ({
    fetcher: user()?.getOrganizationMemberships,
    config: {
      keepPreviousData: userMembershipsSafeValues().keepPreviousData,
      infinite: userMembershipsSafeValues().infinite,
      enabled: !!userMembershipsParams(),
      isSignedIn: user() !== null,
      initialPage: userMembershipsSafeValues().initialPage,
      pageSize: userMembershipsSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.USER_MEMBERSHIPS_KEY,
      authenticated: true,
      tracked: { userId: user()?.id },
      untracked: { args: userMembershipsParams() }
    })
  }));

  const invitations = usePagesOrInfinite<
    GetUserOrganizationInvitationsParams,
    UserOrganizationInvitationResource
  >(() => ({
    fetcher: user()?.getOrganizationInvitations,
    config: {
      keepPreviousData: userInvitationsSafeValues().keepPreviousData,
      infinite: userInvitationsSafeValues().infinite,
      enabled: !!userInvitationsParams(),
      isSignedIn: user() !== null,
      initialPage: userInvitationsSafeValues().initialPage,
      pageSize: userInvitationsSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.USER_INVITATIONS_KEY,
      authenticated: true,
      tracked: { userId: user()?.id },
      untracked: { args: userInvitationsParams() }
    })
  }));

  const suggestions = usePagesOrInfinite<
    GetUserOrganizationSuggestionsParams,
    OrganizationSuggestionResource
  >(() => ({
    fetcher: user()?.getOrganizationSuggestions,
    config: {
      keepPreviousData: userSuggestionsSafeValues().keepPreviousData,
      infinite: userSuggestionsSafeValues().infinite,
      enabled: !!userSuggestionsParams(),
      isSignedIn: user() !== null,
      initialPage: userSuggestionsSafeValues().initialPage,
      pageSize: userSuggestionsSafeValues().pageSize
    },
    keys: createCacheKeys({
      stablePrefix: STABLE_KEYS.USER_SUGGESTIONS_KEY,
      authenticated: true,
      tracked: { userId: user()?.id },
      untracked: { args: userSuggestionsParams() }
    })
  }));

  const isLoaded = createMemo(() => !!(clerk().loaded && user()));

  const createOrganization = (
    params: Parameters<IsomorphicClerk['createOrganization']>[0]
  ) => clerk().createOrganization(params);

  const setActive = (params: Parameters<IsomorphicClerk['setActive']>[0]) =>
    clerk().setActive(params);

  const userMemberships = createMemo(() =>
    isLoaded() ? memberships : undefined
  );
  const userInvitations = createMemo(() =>
    isLoaded() ? invitations : undefined
  );
  const userSuggestions = createMemo(() =>
    isLoaded() ? suggestions : undefined
  );

  return {
    isLoaded,
    createOrganization,
    setActive,
    userMemberships,
    userInvitations,
    userSuggestions
  };
};
