import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  BillingSubscriptionResource,
  ForPayerType
} from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useOrganizationContext } from '../../contexts/organization';
import { useUserContext } from '../../contexts/user';
import { getClerkQueryClient } from '../../query/clerk-query-client';
import { createClerkQuery } from '../../query/create-clerk-query';
import { createCacheKeys, STABLE_KEYS } from '../../query/keys';
import { useAssertWrappedByClerkProvider } from '../use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from '../utils';
import { useBillingIsEnabled } from './use-billing-is-enabled';

export type UseSubscriptionParams = {
  /** `'user'` (the default) or `'organization'`. */
  for?: ForPayerType;
  /** Keep showing the last subscription while it refetches. Defaults to `false`. */
  keepPreviousData?: boolean;
  /** Set to `false` to not fetch. Defaults to `true`. */
  enabled?: boolean;
};

export type UseSubscriptionReturn = {
  data: Accessor<BillingSubscriptionResource | undefined | null>;
  error: Accessor<Error | undefined>;
  isLoading: Accessor<boolean>;
  isFetching: Accessor<boolean>;
  /** Refetches the subscription. */
  revalidate: () => Promise<void> | void;
};

/**
 * The user's or active organization's subscription, as `@clerk/shared`'s
 * `useSubscription`: fetched once billing is on for the payer and a user is
 * signed in, and kept for a minute.
 */
export function useSubscription(
  params: Accessor<UseSubscriptionParams> = () => ({})
): UseSubscriptionReturn {
  useAssertWrappedByClerkProvider('useSubscription');

  const clerk = useIsomorphicClerkContext();
  const user = useUserContext();
  const organization = useOrganizationContext();

  recordTelemetryOnce(clerk, () => eventMethodCalled('useSubscription'));

  const billingEnabled = useBillingIsEnabled(params);

  const keys = createMemo(() => {
    const orgId =
      params().for === 'organization' ? organization()?.id : undefined;
    return createCacheKeys({
      stablePrefix: STABLE_KEYS.SUBSCRIPTION_KEY,
      authenticated: true,
      tracked: { userId: user()?.id, orgId },
      untracked: { args: { orgId } }
    });
  });

  const query = createClerkQuery(() => {
    const enabled = !!user()?.id && billingEnabled();
    return {
      queryKey: keys().queryKey,
      queryFn: ({ queryKey }) =>
        clerk().billing!.getSubscription(
          (queryKey[3] as { args: { orgId?: string } }).args
        ),
      staleTime: 60_000,
      enabled,
      placeholderData:
        (params().keepPreviousData ?? false) && enabled
          ? (previous: BillingSubscriptionResource | undefined) => previous
          : undefined
    };
  });

  return {
    data: () => query().data as BillingSubscriptionResource | undefined | null,
    error: () => (query().error ?? undefined) as Error | undefined,
    isLoading: () => query().isLoading,
    isFetching: () => query().isFetching,
    revalidate: () =>
      getClerkQueryClient()?.invalidateQueries({
        queryKey: keys().invalidationKey
      })
  };
}
