import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  ClerkPaginatedResponse,
  ClerkResource,
  ForPayerType,
  OrganizationResource,
  UserResource
} from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useClerkLoadState } from '../../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useOrganizationContext } from '../../contexts/organization';
import { useUserContext } from '../../contexts/user';
import type { IsomorphicClerk } from '../../isomorphic-clerk';
import { createCacheKeys, type ResourceCacheStableKey } from '../../query/keys';
import type {
  PagesOrInfiniteOptions,
  PaginatedHookConfig,
  PaginatedResources
} from '../../types';
import { useAssertWrappedByClerkProvider } from '../use-assert-wrapped-by-clerk-provider';
import { createSafeValues, usePagesOrInfinite } from '../use-pages-or-infinite';
import { recordTelemetryOnce } from '../utils';
import { useBillingIsEnabled } from './use-billing-is-enabled';

type Fetcher<TResource, TParams> =
  | ((
      params: TParams & { orgId?: string }
    ) => Promise<ClerkPaginatedResponse<TResource>>)
  | undefined;

type BillingHookConfig<TResource extends ClerkResource, TParams> = {
  hookName: string;
  resourceType: ResourceCacheStableKey;
  /** The fetcher for the payer, read in a reactive scope. */
  fetcher: (context: {
    clerk: IsomorphicClerk;
    loaded: boolean;
    payer: ForPayerType;
    user: UserResource | null | undefined;
    organization: OrganizationResource | null | undefined;
  }) => Fetcher<TResource, TParams>;
  options?: {
    /** Plans are public: fetched signed out, and keyed by payer only. */
    unauthenticated?: boolean;
  };
};

export interface BillingHookParams extends PaginatedHookConfig<
  PagesOrInfiniteOptions & {
    /** Set to `false` to not fetch. Defaults to `true`. */
    enabled?: boolean;
  }
> {
  /** `'user'` (the default) or `'organization'`. */
  for?: ForPayerType;
}

/**
 * `@clerk/shared`'s `createBillingPaginatedHook`, on this package's query
 * layer: a paginated billing list for the user or the active organization,
 * fetched once billing is on for that payer. Params are an accessor;
 * `initialPage` and `pageSize` are read once. `@clerk/shared`'s cache-only
 * `__experimental_mode` is not supported.
 *
 * @internal
 */
export function createBillingPaginatedHook<
  TResource extends ClerkResource,
  TParams extends PagesOrInfiniteOptions
>({
  hookName,
  resourceType,
  fetcher,
  options
}: BillingHookConfig<TResource, TParams>) {
  return function useBillingHook<T extends BillingHookParams>(
    params?: Accessor<T>
  ): PaginatedResources<
    TResource,
    T extends { infinite: true } ? true : false
  > {
    useAssertWrappedByClerkProvider(hookName);

    const clerk = useIsomorphicClerkContext();
    const { loaded } = useClerkLoadState();
    const user = useUserContext();
    const organization = useOrganizationContext();

    recordTelemetryOnce(clerk, () => eventMethodCalled(hookName));

    const payer = (): ForPayerType => params?.()?.for || 'user';
    const authenticated = !options?.unauthenticated;

    const safeValues = createSafeValues(() => params?.(), {
      initialPage: 1,
      pageSize: 10,
      keepPreviousData: false,
      infinite: false
    } as T);

    const billingEnabled = useBillingIsEnabled(() => ({
      for: payer(),
      enabled: params?.()?.enabled,
      authenticated
    }));

    const hookParams = createMemo(
      () =>
        ({
          initialPage: safeValues().initialPage,
          pageSize: safeValues().pageSize,
          ...(authenticated && payer() === 'organization'
            ? { orgId: organization()?.id }
            : {})
        }) as unknown as TParams
    );

    return usePagesOrInfinite<TParams, TResource>(() => ({
      fetcher: fetcher({
        clerk: clerk() as unknown as IsomorphicClerk,
        loaded: loaded(),
        payer: payer(),
        user: user(),
        organization: organization()
      }),
      config: {
        keepPreviousData: safeValues().keepPreviousData,
        infinite: safeValues().infinite,
        enabled: loaded() && billingEnabled(),
        ...(authenticated ? { isSignedIn: user() !== null } : {}),
        initialPage: safeValues().initialPage,
        pageSize: safeValues().pageSize
      },
      keys: createCacheKeys({
        stablePrefix: resourceType,
        authenticated,
        tracked: authenticated
          ? {
              userId: user()?.id,
              ...(payer() === 'organization'
                ? { orgId: organization()?.id }
                : {})
            }
          : { for: payer() },
        untracked: { args: hookParams() }
      })
    })) as PaginatedResources<
      TResource,
      T extends { infinite: true } ? true : false
    >;
  };
}
