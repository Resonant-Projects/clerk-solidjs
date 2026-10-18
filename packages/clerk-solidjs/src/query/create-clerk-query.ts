import type {
  DefaultError,
  InfiniteData,
  InfiniteQueryObserverOptions,
  InfiniteQueryObserverResult,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult
} from '@tanstack/query-core';
import {
  InfiniteQueryObserver,
  notifyManager,
  QueryObserver
} from '@tanstack/query-core';
import {
  type Accessor,
  createComputed,
  createSignal,
  on,
  onCleanup,
  untrack
} from 'solid-js';
import { getClerkQueryClient } from './clerk-query-client';

/**
 * Solid's counterpart to `@clerk/shared`'s `useBaseQuery`: a query-core
 * observer on the shared Clerk QueryClient, exposed as an accessor. Unlike
 * `@tanstack/solid-query` it never suspends, so reading a result inside
 * `<Suspense>` does not hide the page while a list refetches, matching
 * @clerk/react. On the server it fetches nothing and reports a pending result.
 */
function createBaseQuery<TResult>(
  options: Accessor<QueryObserverOptions<any, any, any, any, any>>,
  Observer: typeof QueryObserver
): Accessor<TResult> {
  const client = getClerkQueryClient();
  if (!client) {
    return () =>
      ({
        data: undefined,
        error: null,
        isLoading: options().enabled !== false,
        isFetching: false,
        status: 'pending'
      }) as TResult;
  }

  const defaulted = () => {
    const defaultedOptions = client.defaultQueryOptions(options());
    // Report a fetch that is about to start as loading straight away.
    defaultedOptions._optimisticResults = 'optimistic';
    return defaultedOptions;
  };

  const initialOptions = untrack(defaulted);
  const observer = new Observer(client, initialOptions);
  const [result, setResult] = createSignal(
    observer.getOptimisticResult(initialOptions),
    { equals: false }
  );

  // Read the result when the batched notification is delivered, not when it
  // was queued, so a late notification cannot overwrite a newer result.
  const unsubscribe = observer.subscribe(
    notifyManager.batchCalls(() => setResult(observer.getCurrentResult()))
  );
  // Pick up any change between creating the observer and subscribing.
  observer.updateResult();
  onCleanup(unsubscribe);

  createComputed(
    on(
      defaulted,
      (next) => {
        setResult(observer.getOptimisticResult(next));
        observer.setOptions(next);
      },
      { defer: true }
    )
  );

  return result as unknown as Accessor<TResult>;
}

export function createClerkQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: Accessor<
    QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>
  >
): Accessor<QueryObserverResult<TData, TError>> {
  return createBaseQuery(options, QueryObserver);
}

export function createClerkInfiniteQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown
>(
  options: Accessor<
    InfiniteQueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryKey,
      TPageParam
    >
  >
): Accessor<InfiniteQueryObserverResult<TData, TError>> {
  return createBaseQuery(
    options as Accessor<QueryObserverOptions<any, any, any, any, any>>,
    InfiniteQueryObserver as unknown as typeof QueryObserver
  );
}
