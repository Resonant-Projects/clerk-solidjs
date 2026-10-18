import type { InternalClerkScriptProps } from '@clerk/shared/types';
import { getPublicEnvVariables } from '../utils/env';
import { SolidStartClerkProviderProps } from './types';

type SolidStartProviderAndInitialProps = Omit<
  SolidStartClerkProviderProps,
  'children'
>;

export const pickFromClerkInitState = (
  clerkInitState: any
): SolidStartProviderAndInitialProps &
  InternalClerkScriptProps & {
    clerkSsrState: any;
  } => {
  const {
    __clerk_ssr_state,
    __publishableKey,
    __proxyUrl,
    __domain,
    __isSatellite,
    __signInUrl,
    __signUpUrl,
    __afterSignInUrl,
    __afterSignUpUrl,
    __clerkJSUrl,
    __clerkJSVersion,
    __clerkUIUrl,
    __clerkUIVersion,
    __prefetchUI,
    __telemetryDisabled,
    __telemetryDebug,
    __signInForceRedirectUrl,
    __signUpForceRedirectUrl,
    __signInFallbackRedirectUrl,
    __signUpFallbackRedirectUrl,
    __unsafeDisableDevelopmentModeConsoleWarning
  } = clerkInitState || {};

  return {
    clerkSsrState: __clerk_ssr_state,
    publishableKey: __publishableKey,
    proxyUrl: __proxyUrl,
    domain: __domain,
    isSatellite: !!__isSatellite,
    signInUrl: __signInUrl,
    signUpUrl: __signUpUrl,
    afterSignInUrl: __afterSignInUrl,
    afterSignUpUrl: __afterSignUpUrl,
    __internal_clerkJSUrl: __clerkJSUrl,
    __internal_clerkJSVersion: __clerkJSVersion,
    __internal_clerkUIUrl: __clerkUIUrl,
    __internal_clerkUIVersion: __clerkUIVersion,
    prefetchUI: __prefetchUI,
    telemetry: {
      disabled: __telemetryDisabled,
      debug: __telemetryDebug
    },
    signInForceRedirectUrl: __signInForceRedirectUrl,
    signUpForceRedirectUrl: __signUpForceRedirectUrl,
    signInFallbackRedirectUrl: __signInFallbackRedirectUrl,
    signUpFallbackRedirectUrl: __signUpFallbackRedirectUrl,
    unsafe_disableDevelopmentModeConsoleWarning:
      __unsafeDisableDevelopmentModeConsoleWarning
  };
};

export const mergeWithPublicEnvs = (restInitState: any) => {
  const publicEnvVariables = getPublicEnvVariables();
  return {
    ...restInitState,
    publishableKey:
      restInitState.publishableKey || publicEnvVariables.publishableKey,
    proxyUrl: restInitState.proxyUrl || publicEnvVariables.proxyUrl,
    domain: restInitState.domain || publicEnvVariables.domain,
    isSatellite: restInitState.isSatellite || publicEnvVariables.isSatellite,
    signInUrl: restInitState.signInUrl || publicEnvVariables.signInUrl,
    signUpUrl: restInitState.signUpUrl || publicEnvVariables.signUpUrl,
    afterSignInUrl:
      restInitState.afterSignInUrl || publicEnvVariables.afterSignInUrl,
    afterSignUpUrl:
      restInitState.afterSignUpUrl || publicEnvVariables.afterSignUpUrl,
    __internal_clerkJSUrl:
      restInitState.__internal_clerkJSUrl || publicEnvVariables.clerkJsUrl,
    __internal_clerkJSVersion:
      restInitState.__internal_clerkJSVersion ||
      publicEnvVariables.clerkJsVersion,
    __internal_clerkUIUrl:
      restInitState.__internal_clerkUIUrl || publicEnvVariables.clerkUIUrl,
    __internal_clerkUIVersion:
      restInitState.__internal_clerkUIVersion ||
      publicEnvVariables.clerkUIVersion,
    signInForceRedirectUrl: restInitState.signInForceRedirectUrl,
    prefetchUI: restInitState.prefetchUI ?? publicEnvVariables.prefetchUI,
    newSubscriptionRedirectUrl:
      restInitState.newSubscriptionRedirectUrl ||
      publicEnvVariables.newSubscriptionRedirectUrl ||
      undefined,
    unsafe_disableDevelopmentModeConsoleWarning:
      restInitState.unsafe_disableDevelopmentModeConsoleWarning ??
      publicEnvVariables.unsafeDisableDevelopmentModeConsoleWarning,
    telemetry: {
      ...restInitState.telemetry,
      disabled:
        restInitState.telemetry?.disabled ||
        publicEnvVariables.telemetryDisabled,
      debug: restInitState.telemetry?.debug || publicEnvVariables.telemetryDebug
    }
  };
};
