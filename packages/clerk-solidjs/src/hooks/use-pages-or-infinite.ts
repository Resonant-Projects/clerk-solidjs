import type { ClerkAPIResponseError } from '@clerk/shared/error';
import type { ClerkPaginatedResponse } from '@clerk/shared/types';
import { hashKey, type InfiniteData } from '@tanstack/query-core';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  untrack
} from 'solid-js';
import { getClerkQueryClient } from '../query/clerk-query-client';
import {
  createClerkInfiniteQuery,
  createClerkQuery
} from '../query/create-clerk-query';
import { type CacheKeys, withInfiniteKey } from '../query/keys';
import type {
  CacheSetter,
  PagesOrInfiniteOptions,
  PaginatedResources,
  ValueOrSetter
} from '../types';

/**
 * Merges a hook's pagination params with its defaults. `true` means "use the
 * defaults". Like `@clerk/shared`, `initialPage` and `pageSize` are read once,
 * when the hook is created; the other params stay reactive.
 */
export function createSafeValues<T extends PagesOrInfiniteOptions>(
  params: Accessor<T | true | undefined>,
  defaultValues: T
): Accessor<T> {
  const first = untrack(params);
  const firstParams = first === true ? undefined : first;
  const initialPage = firstParams?.initialPage ?? defaultValues.initialPage;
  const pageSize = firstParams?.pageSize ?? defaultValues.pageSize;

  return createMemo(() => {
    const current = params();
    const merged: Record<string, unknown> = {};
    for (const key of Object.keys(defaultValues)) {
      const fallback = (defaultValues as Record<string, unknown>)[key];
      merged[key] =
        current === true
          ? fallback
          : ((current as Record<string, unknown> | undefined)?.[key] ??
            fallback);
    }
    return { ...merged, initialPage, pageSize } as T;
  });
}

export const calculateOffsetCount = (initialPage: number, pageSize: number) =>
  (initialPage - 1) * pageSize;

export const calculatePageCount = (
  totalCount: number,
  offsetCount: number,
  pageSize: number
) => Math.ceil((totalCount - offsetCount) / pageSize);

export const calculateHasNextPage = (
  totalCount: number,
  offsetCount: number,
  currentPage: number,
  pageSize: number
) => totalCount - offsetCount > currentPage * pageSize;

export const calculateHasPreviousPage = (
  currentPage: number,
  pageSize: number,
  offsetCount: number
) => (currentPage - 1) * pageSize > offsetCount;

const keepPreviousData = <T>(previousData: T): T => previousData;

const sameKey = (a: readonly unknown[], b: readonly unknown[]) =>
  hashKey(a) === hashKey(b);

export type PagesOrInfiniteParams<Args, Data> = {
  fetcher: ((args: Args) => Promise<ClerkPaginatedResponse<Data>>) | undefined;
  config: {
    enabled?: boolean;
    infinite?: boolean;
    keepPreviousData?: boolean;
    /** `false` once the owner of the list has signed out; clears its cache. */
    isSignedIn?: boolean;
    initialPage?: number;
    pageSize?: number;
  };
  keys: CacheKeys<Args | undefined>;
};

/**
 * A paginated or infinite list over the shared Clerk QueryClient, ported from
 * `@clerk/shared`'s `usePagesOrInfinite`: same cache keys, a 60-second stale
 * time, optional previous-data placeholders, and a cache cleared on sign-out.
 * Every field is an accessor; the functions read the current mode when called.
 */
export function usePagesOrInfinite<Args, Data>(
  params: Accessor<PagesOrInfiniteParams<Args, Data>>
): PaginatedResources<Data> {
  const client = getClerkQueryClient();

  // Read once, like @clerk/shared, so a re-render never resets the page.
  const initialPage = untrack(() => params().config.initialPage ?? 1);
  const pageSize = untrack(() => params().config.pageSize ?? 10);
  const offsetCount = calculateOffsetCount(initialPage, pageSize);

  const [paginatedPage, setPaginatedPage] = createSignal(initialPage);
  // Bumped when the cache changes in a way no observer reports, such as
  // setData on a disabled list or the sign-out cleanup.
  const [cacheVersion, setCacheVersion] = createSignal(0);
  const bumpCacheVersion = () => setCacheVersion((n) => n + 1);

  const triggerInfinite = createMemo(() => params().config.infinite ?? false);
  const queriesEnabled = createMemo(() => {
    const { fetcher, config } = params();
    return (config.enabled ?? true) && !!fetcher && config.isSignedIn !== false;
  });

  const pagesQueryKey = createMemo(
    () => {
      const [stablePrefix, authenticated, tracked, untracked] =
        params().keys.queryKey;
      return [
        stablePrefix,
        authenticated,
        tracked,
        {
          ...untracked,
          args: {
            ...untracked.args,
            initialPage: paginatedPage(),
            pageSize
          } as Args
        }
      ] as const;
    },
    undefined,
    { equals: sameKey }
  );

  const infiniteQueryKey = createMemo(
    () => {
      const [stablePrefix, authenticated, tracked, untracked] =
        params().keys.queryKey;
      return [
        `${stablePrefix}-inf`,
        authenticated,
        tracked,
        untracked
      ] as const;
    },
    undefined,
    { equals: sameKey }
  );

  const singlePageQuery = createClerkQuery(() => {
    const fetcher = params().fetcher;
    return {
      queryKey: pagesQueryKey(),
      queryFn: ({ queryKey }) => fetcher!(queryKey[3].args),
      staleTime: 60_000,
      enabled: queriesEnabled() && !triggerInfinite(),
      placeholderData: params().config.keepPreviousData
        ? keepPreviousData
        : undefined
    };
  });

  const infiniteQuery = createClerkInfiniteQuery(() => {
    const fetcher = params().fetcher;
    return {
      queryKey: infiniteQueryKey(),
      initialPageParam: initialPage,
      getNextPageParam: (
        lastPage: ClerkPaginatedResponse<Data>,
        allPages: ClerkPaginatedResponse<Data>[],
        lastPageParam: number
      ) => {
        const total = lastPage?.total_count ?? 0;
        const consumed = (allPages.length + initialPage - 1) * pageSize;
        return consumed < total ? lastPageParam + 1 : undefined;
      },
      queryFn: ({ pageParam, queryKey }) =>
        fetcher!({
          ...queryKey[3].args,
          initialPage: pageParam,
          pageSize
        } as Args),
      staleTime: 60_000,
      enabled: queriesEnabled() && triggerInfinite()
    };
  });

  // Clear this list's cached pages when its owner signs out, as
  // @clerk/shared's useClearQueriesOnSignOut does.
  createEffect(
    on(
      () => params().config.isSignedIn === false,
      (isSignedOut, wasSignedOut) => {
        const { keys } = untrack(params);
        if (!client || keys.authenticated !== true) return;
        if (wasSignedOut === false && isSignedOut) {
          const stableKeys: readonly string[] = withInfiniteKey(keys.stableKey);
          client.removeQueries({
            predicate: (query) => {
              const [stableKey, authenticated] = query.queryKey;
              return (
                authenticated === true &&
                typeof stableKey === 'string' &&
                stableKeys.includes(stableKey)
              );
            }
          });
          setPaginatedPage(initialPage);
          queueMicrotask(bumpCacheVersion);
        }
      }
    )
  );

  // Data, count and page come from one source so they always agree.
  const pagedState = createMemo(() => {
    cacheVersion();
    // Track both observers even while the list is disabled: another hook can
    // fetch or setData the same key, and only the observers report that.
    const single = singlePageQuery();
    const infinite = infiniteQuery();
    if (triggerInfinite()) {
      const cached =
        client?.getQueryData<InfiniteData<ClerkPaginatedResponse<Data>>>(
          infiniteQueryKey()
        );
      const pages = queriesEnabled()
        ? (infinite.data?.pages ?? cached?.pages ?? [])
        : (cached?.pages ?? []);
      const validPages = Array.isArray(pages) ? pages.filter(Boolean) : [];
      return {
        data: validPages
          .flatMap((page) => page?.data ?? [])
          .filter(Boolean) as Data[],
        count: validPages[validPages.length - 1]?.total_count ?? 0,
        page: validPages.length > 0 ? validPages.length : initialPage
      };
    }

    // A disabled list's query result is stale, so read only the cache.
    const pageData = queriesEnabled()
      ? (single.data ??
        client?.getQueryData<ClerkPaginatedResponse<Data>>(pagesQueryKey()))
      : client?.getQueryData<ClerkPaginatedResponse<Data>>(pagesQueryKey());
    return {
      data: Array.isArray(pageData?.data) ? pageData.data : [],
      count:
        typeof pageData?.total_count === 'number' ? pageData.total_count : 0,
      page: paginatedPage()
    };
  });

  const data = createMemo(() => pagedState().data);
  const count = createMemo(() => pagedState().count);
  const page = createMemo(() => pagedState().page);
  const isLoading = createMemo(() =>
    triggerInfinite() ? infiniteQuery().isLoading : singlePageQuery().isLoading
  );
  const isFetching = createMemo(() =>
    triggerInfinite()
      ? infiniteQuery().isFetching
      : singlePageQuery().isFetching
  );
  const error = createMemo(
    () =>
      ((triggerInfinite() ? infiniteQuery().error : singlePageQuery().error) ??
        null) as ClerkAPIResponseError | null
  );
  const isError = createMemo(() => !!error());
  const pageCount = createMemo(() =>
    calculatePageCount(count(), offsetCount, pageSize)
  );
  const hasNextPage = createMemo(() =>
    triggerInfinite()
      ? Boolean(infiniteQuery().hasNextPage)
      : calculateHasNextPage(count(), offsetCount, page(), pageSize)
  );
  const hasPreviousPage = createMemo(() =>
    triggerInfinite()
      ? Boolean(infiniteQuery().hasPreviousPage)
      : calculateHasPreviousPage(page(), pageSize, offsetCount)
  );

  const fetchPage: ValueOrSetter<number> = (numberOrFn) => {
    if (untrack(triggerInfinite)) {
      const next =
        typeof numberOrFn === 'function'
          ? numberOrFn(untrack(page))
          : numberOrFn;
      const loadedPages =
        untrack(infiniteQuery).data?.pages.length ??
        client?.getQueryData<InfiniteData<unknown>>(untrack(infiniteQueryKey))
          ?.pages.length ??
        0;
      if (Math.max(0, next) > loadedPages) {
        void untrack(infiniteQuery).fetchNextPage({ cancelRefetch: false });
      }
      return;
    }
    setPaginatedPage(numberOrFn);
  };

  const fetchNext = () => {
    if (untrack(triggerInfinite)) {
      void untrack(infiniteQuery).fetchNextPage({ cancelRefetch: false });
      return;
    }
    setPaginatedPage((n) => Math.max(0, n + 1));
  };

  const fetchPrevious = () => {
    // Infinite lists only page forward, as in @clerk/shared.
    if (untrack(triggerInfinite)) return;
    setPaginatedPage((n) => Math.max(0, n - 1));
  };

  const setData: CacheSetter<any> = (value) => {
    if (client) {
      if (untrack(triggerInfinite)) {
        client.setQueryData(untrack(infiniteQueryKey), (previous: any = {}) => {
          const previousPages = Array.isArray(previous?.pages)
            ? previous.pages
            : [];
          const nextPages =
            typeof value === 'function' ? value(previousPages) : value;
          // query-core reads pageParams[i] for page i, so a list seeded
          // before its first fetch needs one param per page.
          const previousParams: unknown[] = Array.isArray(previous?.pageParams)
            ? previous.pageParams
            : [];
          const pageParams = Array.isArray(nextPages)
            ? nextPages.map(
                (_page: unknown, index: number) =>
                  previousParams[index] ?? initialPage + index
              )
            : previousParams;
          return { ...previous, pages: nextPages, pageParams };
        });
      } else {
        client.setQueryData(
          untrack(pagesQueryKey),
          (previous: any = { data: [], total_count: 0 }) =>
            typeof value === 'function' ? value(previous) : value
        );
      }
      bumpCacheVersion();
    }
    return Promise.resolve(undefined);
  };

  const revalidate = async () => {
    if (!client) return;
    const { invalidationKey } = untrack(params).keys;
    await client.invalidateQueries({ queryKey: invalidationKey });
    const [stablePrefix, ...rest] = invalidationKey;
    await client.invalidateQueries({
      queryKey: [`${stablePrefix}-inf`, ...rest]
    });
  };

  return {
    data,
    count,
    error,
    isLoading,
    isFetching,
    isError,
    page,
    pageCount,
    fetchPage,
    fetchNext,
    fetchPrevious,
    hasNextPage,
    hasPreviousPage,
    setData,
    revalidate
  };
}
