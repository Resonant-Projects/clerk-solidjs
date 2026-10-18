import type { ClerkRequest } from '@clerk/backend/internal';
import { apiUrlFromPublishableKey } from '@clerk/shared/apiUrlFromPublishableKey';
import { isDevelopmentFromSecretKey } from '@clerk/shared/keys';
import { isHttpOrHttps, isProxyUrlRelative } from '@clerk/shared/proxy';
import { handleValueOrFn } from '@clerk/shared/utils';

import { errorThrower } from '../../errors/error-thrower';
import { getEnvVariable, getPublicEnvVariables } from '../utils/env';
import { commonEnvs } from './constants';
import type { ClerkMiddlewareOptions } from './types';

/**
 * Resolves the middleware options for one request: options passed in win,
 * then the env, read now rather than at import.
 */
export const loadOptions = (
  request: ClerkRequest,
  overrides: ClerkMiddlewareOptions = {}
) => {
  const env = commonEnvs();
  const secretKey = overrides.secretKey || env.SECRET_KEY;
  const machineSecretKey = overrides.machineSecretKey || env.MACHINE_SECRET_KEY;
  const publishableKey = overrides.publishableKey || env.PUBLISHABLE_KEY;
  const jwtKey = overrides.jwtKey || env.CLERK_JWT_KEY;
  const apiUrl =
    getEnvVariable('CLERK_API_URL') || apiUrlFromPublishableKey(publishableKey);
  const domain =
    handleValueOrFn(overrides.domain, new URL(request.url)) || env.DOMAIN;
  const isSatellite =
    handleValueOrFn(overrides.isSatellite, new URL(request.url)) ||
    env.IS_SATELLITE;
  const relativeOrAbsoluteProxyUrl = handleValueOrFn(
    overrides.proxyUrl,
    request.clerkUrl,
    env.PROXY_URL
  );
  const signInUrl = overrides.signInUrl || env.SIGN_IN_URL;
  const signUpUrl = overrides.signUpUrl || env.SIGN_UP_URL;
  const afterSignInUrl =
    overrides.afterSignInUrl || getPublicEnvVariables().afterSignInUrl;
  const afterSignUpUrl =
    overrides.afterSignUpUrl || getPublicEnvVariables().afterSignUpUrl;

  let proxyUrl;
  if (
    !!relativeOrAbsoluteProxyUrl &&
    isProxyUrlRelative(relativeOrAbsoluteProxyUrl)
  ) {
    proxyUrl = new URL(relativeOrAbsoluteProxyUrl, request.clerkUrl).toString();
  } else {
    proxyUrl = relativeOrAbsoluteProxyUrl;
  }

  if (!secretKey) {
    errorThrower.throwMissingSecretKeyError();
  }

  if (isSatellite && !proxyUrl && !domain) {
    throw errorThrower.throw(
      'Clerk: satellite mode requires a proxy URL or domain'
    );
  }

  if (
    isSatellite &&
    !isHttpOrHttps(signInUrl) &&
    isDevelopmentFromSecretKey(secretKey)
  ) {
    throw errorThrower.throw(
      'Clerk: satellite mode requires a sign-in URL in production'
    );
  }

  return {
    // Every other authenticateRequest option passes through.
    ...overrides,
    secretKey,
    machineSecretKey,
    publishableKey,
    jwtKey,
    apiUrl,
    domain,
    isSatellite,
    proxyUrl,
    signInUrl,
    signUpUrl,
    afterSignInUrl,
    afterSignUpUrl
  };
};

export type LoadedOptions = ReturnType<typeof loadOptions>;
