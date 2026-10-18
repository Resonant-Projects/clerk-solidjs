/**
 * Cache keys shared with `@clerk/shared`, so a query here has the same
 * `[stablePrefix, authenticated, tracked, untracked]` shape as in @clerk/react.
 */
export const STABLE_KEYS = {
  USER_MEMBERSHIPS_KEY: 'userMemberships',
  USER_INVITATIONS_KEY: 'userInvitations',
  USER_SUGGESTIONS_KEY: 'userSuggestions',
  DOMAINS_KEY: 'domains',
  MEMBERSHIP_REQUESTS_KEY: 'membershipRequests',
  MEMBERSHIPS_KEY: 'memberships',
  INVITATIONS_KEY: 'invitations'
} as const;

export type ResourceCacheStableKey =
  (typeof STABLE_KEYS)[keyof typeof STABLE_KEYS];

export type CacheKeys<Args> = {
  queryKey: readonly [
    ResourceCacheStableKey,
    boolean,
    Record<string, unknown>,
    { args: Args }
  ];
  invalidationKey: readonly [
    ResourceCacheStableKey,
    boolean,
    Record<string, unknown>
  ];
  stableKey: ResourceCacheStableKey;
  authenticated: boolean;
};

export function createCacheKeys<Args>(params: {
  stablePrefix: ResourceCacheStableKey;
  authenticated: boolean;
  tracked: Record<string, unknown>;
  untracked: { args: Args };
}): CacheKeys<Args> {
  return {
    queryKey: [
      params.stablePrefix,
      params.authenticated,
      params.tracked,
      params.untracked
    ],
    invalidationKey: [
      params.stablePrefix,
      params.authenticated,
      params.tracked
    ],
    stableKey: params.stablePrefix,
    authenticated: params.authenticated
  };
}

/** Infinite queries live under the same prefix with an `-inf` suffix. */
export const withInfiniteKey = <T extends string>(key: T) =>
  [key, `${key}-inf`] as const;
