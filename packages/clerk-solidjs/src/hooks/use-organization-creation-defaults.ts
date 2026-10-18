import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  ClerkAPIResponseError,
  OrganizationCreationDefaultsResource
} from '@clerk/shared/types';
import { Accessor } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useUserContext } from '../contexts/user';
import { createClerkQuery } from '../query/create-clerk-query';
import { createCacheKeys, STABLE_KEYS } from '../query/keys';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

export type UseOrganizationCreationDefaultsParams = {
  /** Keep showing the last defaults while they refetch. Defaults to `true`. */
  keepPreviousData?: boolean;
  /** Set to `false` to not fetch. Defaults to `true`. */
  enabled?: boolean;
};

export type UseOrganizationCreationDefaultsReturn = {
  data: Accessor<OrganizationCreationDefaultsResource | undefined | null>;
  error: Accessor<ClerkAPIResponseError | null>;
  isLoading: Accessor<boolean>;
  isFetching: Accessor<boolean>;
};

/**
 * The defaults Clerk suggests for the signed-in user's new organization,
 * such as a name from their email domain, as `@clerk/shared`'s hook. It
 * fetches only when the instance has organization creation defaults turned
 * on, Clerk has loaded and a user is signed in.
 */
export function useOrganizationCreationDefaults(
  params: Accessor<UseOrganizationCreationDefaultsParams> = () => ({})
): UseOrganizationCreationDefaultsReturn {
  useAssertWrappedByClerkProvider('useOrganizationCreationDefaults');

  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  const user = useUserContext();

  recordTelemetryOnce(clerk, () =>
    eventMethodCalled('useOrganizationCreationDefaults')
  );

  const query = createClerkQuery(() => {
    const currentUser = user();
    const featureEnabled =
      clerk().__internal_environment?.organizationSettings
        ?.organizationCreationDefaults?.enabled ?? false;
    return {
      queryKey: createCacheKeys({
        stablePrefix: STABLE_KEYS.ORGANIZATION_CREATION_DEFAULTS_KEY,
        authenticated: !!currentUser,
        tracked: { userId: currentUser?.id ?? null },
        untracked: { args: {} }
      }).queryKey,
      queryFn: () => currentUser!.getOrganizationCreationDefaults(),
      enabled:
        !!currentUser &&
        (params().enabled ?? true) &&
        featureEnabled &&
        loaded(),
      placeholderData:
        (params().keepPreviousData ?? true)
          ? (previous: OrganizationCreationDefaultsResource | undefined) =>
              previous
          : undefined
    };
  });

  return {
    data: () =>
      query().data as OrganizationCreationDefaultsResource | undefined | null,
    error: () => (query().error ?? null) as ClerkAPIResponseError | null,
    isLoading: () => query().isLoading,
    isFetching: () => query().isFetching
  };
}
