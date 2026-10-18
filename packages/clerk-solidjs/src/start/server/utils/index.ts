import type { RequestState } from '@clerk/backend/internal';
import { debugRequestState } from '@clerk/backend/internal';
import { isTruthy } from '@clerk/shared/underscore';
import { getEnvVariable, getPublicEnvVariables } from '../../utils/env';
import type { AdditionalStateOptions, AnyRequestState } from '../types';

/**
 * Wraps obscured clerk internals with a readable `clerkState` key.
 * This is intended to be passed into <ClerkProvider>
 *
 * @internal
 */
export const wrapWithClerkState = (data: any) => {
  return { __internal_clerk_state: { ...data } };
};

/**
 * Returns the prefetchUI config from environment variables.
 *
 * @internal
 */
function getPrefetchUIFromEnv(): boolean | undefined {
  if (getEnvVariable('CLERK_PREFETCH_UI') === 'false') {
    return false;
  }
  return undefined;
}

/**
 * Returns the clerk state object and observability headers to be injected into a context.
 *
 * @internal
 */
export function getResponseClerkState(
  requestState: AnyRequestState,
  additionalStateOptions: AdditionalStateOptions = {}
) {
  const clerkInitialState = wrapWithClerkState({
    __clerk_ssr_state: requestState.toAuth(),
    __publishableKey: requestState.publishableKey,
    __proxyUrl: requestState.proxyUrl,
    __domain: requestState.domain,
    __isSatellite: requestState.isSatellite,
    __signInUrl: requestState.signInUrl,
    __signUpUrl: requestState.signUpUrl,
    __clerk_debug: debugRequestState(requestState as RequestState),
    __clerkJSUrl: getEnvVariable('CLERK_JS') || getEnvVariable('CLERK_JS_URL'),
    __clerkJSVersion: getEnvVariable('CLERK_JS_VERSION'),
    __clerkUIUrl: getEnvVariable('CLERK_UI_URL'),
    __clerkUIVersion: getEnvVariable('CLERK_UI_VERSION'),
    __prefetchUI: getPrefetchUIFromEnv(),
    __telemetryDisabled: isTruthy(getEnvVariable('CLERK_TELEMETRY_DISABLED')),
    __telemetryDebug: isTruthy(getEnvVariable('CLERK_TELEMETRY_DEBUG')),
    __unsafeDisableDevelopmentModeConsoleWarning:
      getPublicEnvVariables().unsafeDisableDevelopmentModeConsoleWarning,
    // A server-only CLERK_CHECKOUT_CONTINUE_URL reaches the browser this way.
    __newSubscriptionRedirectUrl:
      getPublicEnvVariables().newSubscriptionRedirectUrl || undefined,
    __signInForceRedirectUrl:
      additionalStateOptions.signInForceRedirectUrl ||
      getEnvVariable('CLERK_SIGN_IN_FORCE_REDIRECT_URL') ||
      '',
    __signUpForceRedirectUrl:
      additionalStateOptions.signUpForceRedirectUrl ||
      getEnvVariable('CLERK_SIGN_UP_FORCE_REDIRECT_URL') ||
      '',
    __signInFallbackRedirectUrl:
      additionalStateOptions.signInFallbackRedirectUrl ||
      getEnvVariable('CLERK_SIGN_IN_FALLBACK_REDIRECT_URL') ||
      '',
    __signUpFallbackRedirectUrl:
      additionalStateOptions.signUpFallbackRedirectUrl ||
      getEnvVariable('CLERK_SIGN_UP_FALLBACK_REDIRECT_URL') ||
      ''
  });

  return {
    clerkInitialState,
    headers: requestState.headers
  };
}
