import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  ClerkAPIResponseError,
  GetOAuthConsentInfoParams,
  OAuthConsentInfo
} from '@clerk/shared/types';
import { Accessor, createMemo } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useUserContext } from '../contexts/user';
import { createClerkQuery } from '../query/create-clerk-query';
import { createCacheKeys, STABLE_KEYS } from '../query/keys';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

export type UseOAuthConsentParams = Pick<
  GetOAuthConsentInfoParams,
  'oauthClientId' | 'scope' | 'redirectUri'
> & {
  /** Keep showing the last consent info while new params load. Defaults to `true`. */
  keepPreviousData?: boolean;
  /** Set to `false` to not fetch. Defaults to `true`. */
  enabled?: boolean;
};

export type UseOAuthConsentReturn = {
  data: Accessor<OAuthConsentInfo | undefined>;
  error: Accessor<ClerkAPIResponseError | null>;
  isLoading: Accessor<boolean>;
  isFetching: Accessor<boolean>;
};

/**
 * The consent info an OAuth application shows the signed-in user: the
 * application and the scopes it asks for. It fetches once Clerk has loaded
 * and a user is signed in, and follows the params, which you pass as an
 * accessor.
 *
 * @example
 * const consent = useOAuthConsent(() => ({ oauthClientId: clientId(), scope: 'openid' }));
 * <Show when={consent.data()}>{(info) => <h1>{info().oauthApplicationName}</h1>}</Show>
 */
export function useOAuthConsent(
  params: Accessor<UseOAuthConsentParams>
): UseOAuthConsentReturn {
  useAssertWrappedByClerkProvider('useOAuthConsent');

  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  const user = useUserContext();

  recordTelemetryOnce(clerk, () => eventMethodCalled('useOAuthConsent'));

  const request = createMemo(() => {
    const { oauthClientId, scope, redirectUri } = params();
    return {
      oauthClientId: (oauthClientId ?? '').trim(),
      ...(scope !== undefined && { scope }),
      ...(redirectUri !== undefined && { redirectUri })
    };
  });

  const enabled = () =>
    !!user() &&
    request().oauthClientId.length > 0 &&
    (params().enabled ?? true) &&
    loaded();

  const query = createClerkQuery(() => {
    const isEnabled = enabled();
    const args = request();
    return {
      queryKey: createCacheKeys({
        stablePrefix: STABLE_KEYS.OAUTH_CONSENT_INFO_KEY,
        authenticated: true,
        tracked: { userId: user()?.id ?? null },
        untracked: { args }
      }).queryKey,
      // The args this key was built from.
      queryFn: ({ queryKey }) =>
        clerk().oauthApplication!.getConsentInfo(queryKey[3].args),
      enabled: isEnabled,
      placeholderData:
        (params().keepPreviousData ?? true) && isEnabled
          ? (previous: OAuthConsentInfo | undefined) => previous
          : undefined
    };
  });

  return {
    data: () => query().data as OAuthConsentInfo | undefined,
    error: () => (query().error ?? null) as ClerkAPIResponseError | null,
    isLoading: () => query().isLoading,
    isFetching: () => query().isFetching
  };
}
