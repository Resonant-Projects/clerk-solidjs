import { QueryClient } from '@tanstack/query-core';

/**
 * The QueryClient behind every Clerk query hook, mirroring `@clerk/shared`:
 * created lazily, in the browser only, and shared by every hook so lists are
 * cached and deduplicated across components. Server renders get `undefined`,
 * so requests never share a cache.
 */
let clerkQueryClient: QueryClient | undefined;

export function getClerkQueryClient(): QueryClient | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  clerkQueryClient ??= new QueryClient();
  return clerkQueryClient;
}

/** Test-only: install a client with deterministic defaults, or reset it. */
export function __setClerkQueryClientForTest(
  client: QueryClient | undefined
): void {
  clerkQueryClient = client;
}
