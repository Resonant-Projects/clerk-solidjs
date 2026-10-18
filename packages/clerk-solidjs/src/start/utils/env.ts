import { getEnvVariable as getSharedEnvVariable } from '@clerk/shared/getEnvVariable';
import { isTruthy } from '@clerk/shared/underscore';

/**
 * Reads an environment variable from `process.env`, Vite's `import.meta.env`,
 * a Cloudflare-style `context.env`, or `globalThis`, through
 * `@clerk/shared/getEnvVariable`. Read it when it is needed, not at import:
 * some runtimes only provide bindings once a request arrives.
 *
 * @internal
 */
export const getEnvVariable = (
  name: string,
  defaultValue = '',
  context?: Record<string, any>
): string => getSharedEnvVariable(name, context) || defaultValue;

/** `VITE_<name>` (exposed to the browser by Vite), then `<name>`. */
const getPublicEnvVariable = (name: string, context?: Record<string, any>) =>
  getEnvVariable(`VITE_${name}`, '', context) ||
  getEnvVariable(name, '', context);

export const getPublicEnvVariables = (context?: Record<string, any>) => {
  const get = (name: string) => getPublicEnvVariable(name, context);
  const unsafeDisableDevelopmentModeConsoleWarning = get(
    'CLERK_UNSAFE_DISABLE_DEVELOPMENT_MODE_CONSOLE_WARNING'
  );
  return {
    publishableKey: get('CLERK_PUBLISHABLE_KEY'),
    domain: get('CLERK_DOMAIN'),
    isSatellite: isTruthy(get('CLERK_IS_SATELLITE')),
    proxyUrl: get('CLERK_PROXY_URL'),
    pk: get('CLERK_PUBLISHABLE_KEY'),
    signInUrl: get('CLERK_SIGN_IN_URL'),
    signUpUrl: get('CLERK_SIGN_UP_URL'),
    clerkJsUrl: get('CLERK_JS_URL') || getEnvVariable('CLERK_JS', '', context),
    clerkJsVersion: get('CLERK_JS_VERSION'),
    clerkUIUrl: get('CLERK_UI_URL'),
    clerkUIVersion: get('CLERK_UI_VERSION'),
    prefetchUI: get('CLERK_PREFETCH_UI') === 'false' ? false : undefined,
    telemetryDisabled: isTruthy(get('CLERK_TELEMETRY_DISABLED')),
    telemetryDebug: isTruthy(get('CLERK_TELEMETRY_DEBUG')),
    unsafeDisableDevelopmentModeConsoleWarning:
      unsafeDisableDevelopmentModeConsoleWarning
        ? isTruthy(unsafeDisableDevelopmentModeConsoleWarning)
        : undefined,
    newSubscriptionRedirectUrl: get('CLERK_CHECKOUT_CONTINUE_URL'),
    afterSignInUrl: get('CLERK_AFTER_SIGN_IN_URL'),
    afterSignUpUrl: get('CLERK_AFTER_SIGN_UP_URL')
  };
};
