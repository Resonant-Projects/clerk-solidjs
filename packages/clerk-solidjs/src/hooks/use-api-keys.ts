import { eventMethodCalled } from '@clerk/shared/telemetry';
import type { APIKeyResource, GetAPIKeysParams } from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useUserContext } from '../contexts/user';
import { createCacheKeys, STABLE_KEYS } from '../query/keys';
import type { PaginatedHookConfig, PaginatedResources } from '../types';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { createSafeValues, usePagesOrInfinite } from './use-pages-or-infinite';
import { recordTelemetryOnce } from './utils';

export type UseAPIKeysParams = PaginatedHookConfig<
  GetAPIKeysParams & {
    /** Set to `false` to not fetch. Defaults to `true`. */
    enabled?: boolean;
  }
>;

export type UseAPIKeysReturn<T extends UseAPIKeysParams> = PaginatedResources<
  APIKeyResource,
  T extends { infinite: true } ? true : false
>;

/**
 * Pages through the API keys of a user or organization (`subject`), as
 * `@clerk/shared`'s `useAPIKeys` does. Pass the params as an accessor to keep
 * `subject`, `query` and `enabled` reactive; `initialPage` and `pageSize` are
 * read once.
 *
 * @example
 * const keys = useAPIKeys(() => ({ subject: organization()?.id }));
 * <For each={keys.data()}>{(key) => <li>{key.name}</li>}</For>
 */
export function useAPIKeys<T extends UseAPIKeysParams>(
  params?: Accessor<T>
): UseAPIKeysReturn<T> {
  useAssertWrappedByClerkProvider('useAPIKeys');

  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  const user = useUserContext();

  recordTelemetryOnce(clerk, () => eventMethodCalled('useAPIKeys'));

  const safeValues = createSafeValues(() => params?.(), {
    initialPage: 1,
    pageSize: 10,
    keepPreviousData: false,
    infinite: false,
    subject: '',
    query: '',
    enabled: true
  } as UseAPIKeysParams);

  const hookParams = createMemo((): GetAPIKeysParams => ({
    initialPage: safeValues().initialPage,
    pageSize: safeValues().pageSize,
    ...(safeValues().subject ? { subject: safeValues().subject } : {}),
    ...(safeValues().query ? { query: safeValues().query } : {})
  }));

  return usePagesOrInfinite<GetAPIKeysParams, APIKeyResource>(() => {
    const apiKeys = clerk().apiKeys;
    return {
      // The subject from the key's args, so every page of a query matches
      // the subject it is cached under.
      fetcher: apiKeys?.getAll
        ? (args: GetAPIKeysParams) =>
            apiKeys.getAll({ ...args, subject: args.subject ?? '' })
        : undefined,
      config: {
        keepPreviousData: safeValues().keepPreviousData,
        infinite: safeValues().infinite,
        enabled: (safeValues().enabled ?? true) && loaded(),
        isSignedIn: user() !== null,
        initialPage: safeValues().initialPage,
        pageSize: safeValues().pageSize
      },
      keys: createCacheKeys({
        stablePrefix: STABLE_KEYS.API_KEYS_KEY,
        authenticated: true,
        // The user too: with the default subject, two accounts would
        // otherwise share a key across a direct account switch.
        tracked: { userId: user()?.id, subject: safeValues().subject },
        untracked: { args: hookParams() }
      })
    };
  }) as UseAPIKeysReturn<T>;
}
