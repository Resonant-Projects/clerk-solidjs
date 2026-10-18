import { apiUrlFromPublishableKey } from '@clerk/shared/apiUrlFromPublishableKey';

import { getEnvVariable, getPublicEnvVariables } from '../utils/env';

/**
 * The Clerk environment variables, read when called rather than at import,
 * so runtimes that provide bindings per request (Cloudflare Workers, for
 * example) and env set after startup both work. Pass `context` to read
 * bindings from it, for example `{ env }` on Workers.
 *
 * @internal
 */
export const commonEnvs = (context?: Record<string, any>) => {
  const publicEnvs = getPublicEnvVariables(context);
  const get = (name: string) => getEnvVariable(name, '', context);

  return {
    CLERK_JS_VERSION: publicEnvs.clerkJsVersion,
    CLERK_JS_URL: publicEnvs.clerkJsUrl,
    CLERK_UI_URL: publicEnvs.clerkUIUrl,
    CLERK_UI_VERSION: publicEnvs.clerkUIVersion,
    PREFETCH_UI: publicEnvs.prefetchUI,
    PUBLISHABLE_KEY: publicEnvs.publishableKey,
    DOMAIN: publicEnvs.domain,
    PROXY_URL: publicEnvs.proxyUrl,
    IS_SATELLITE: publicEnvs.isSatellite,
    SIGN_IN_URL: publicEnvs.signInUrl,
    SIGN_UP_URL: publicEnvs.signUpUrl,
    TELEMETRY_DISABLED: publicEnvs.telemetryDisabled,
    TELEMETRY_DEBUG: publicEnvs.telemetryDebug,
    UNSAFE_DISABLE_DEVELOPMENT_MODE_CONSOLE_WARNING:
      publicEnvs.unsafeDisableDevelopmentModeConsoleWarning,

    // Server-only.
    API_VERSION: get('CLERK_API_VERSION') || 'v1',
    SECRET_KEY: get('CLERK_SECRET_KEY'),
    MACHINE_SECRET_KEY: get('CLERK_MACHINE_SECRET_KEY'),
    ENCRYPTION_KEY: get('CLERK_ENCRYPTION_KEY'),
    CLERK_JWT_KEY: get('CLERK_JWT_KEY'),
    API_URL:
      get('CLERK_API_URL') ||
      apiUrlFromPublishableKey(publicEnvs.publishableKey),

    // The same name the SolidStart ClerkProvider reports in the browser.
    SDK_METADATA: {
      name: `${PACKAGE_NAME}/start`,
      version: PACKAGE_VERSION,
      environment: get('NODE_ENV')
    }
  } as const;
};
