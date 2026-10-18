import { QueryClient } from '@tanstack/query-core';

/**
 * The QueryClient behind every Clerk query hook, mirroring `@clerk/shared`:
 * created lazily, in the browser only, and shared by every hook so lists are
 * cached and deduplicated across components. Server renders get `undefined`,
 * so requests never share a cache.
 *
 * Unlike `@clerk/shared`, the client is mounted. A retry that pauses while the
 * tab is hidden or offline resumes only on the focus and online events that
 * `mount()` connects; without them it stays paused, and the list never gets
 * data or an error. Refetching on focus and reconnect stays off, so the hooks
 * fetch exactly as `@clerk/react`'s do.
 */
let clerkQueryClient: QueryClient | undefined;

const createClerkQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, refetchOnReconnect: false }
    }
  });

export function getClerkQueryClient(): QueryClient | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  if (!clerkQueryClient) {
    clerkQueryClient = createClerkQueryClient();
    // Shared for the page's lifetime, so it is never unmounted.
    clerkQueryClient.mount();
  }
  return clerkQueryClient;
}

/** Test-only: install a client with deterministic defaults, or reset it. */
export function __setClerkQueryClientForTest(
  client: QueryClient | undefined
): void {
  clerkQueryClient?.unmount();
  client?.mount();
  clerkQueryClient = client;
}
