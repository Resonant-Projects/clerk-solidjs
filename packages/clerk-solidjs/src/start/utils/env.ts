import { getEnvVariable as getSharedEnvVariable } from '@clerk/shared/getEnvVariable';
import { isTruthy } from '@clerk/shared/underscore';
import { getRequestEvent } from 'solid-js/web';

type WithRuntime = { runtime?: Record<string, any> };

/**
 * The current request's runtime bindings. On Cloudflare, nitro puts the
 * Worker's `env` on `request.runtime.cloudflare`, where `getEnvVariable`
 * looks for it. A single-flight render replaces the event's request with a
 * new page Request, so fall back to the h3 event's, which is the original.
 * In the browser there is no request event.
 */
const requestRuntime = (): Record<string, any> | undefined => {
  const event = getRequestEvent() as
    { request?: WithRuntime; nativeEvent?: { req?: WithRuntime } } | undefined;
  return event?.request?.runtime ?? event?.nativeEvent?.req?.runtime;
};

/**
 * Reads an environment variable from `process.env`, Vite's `import.meta.env`,
 * the request's Cloudflare bindings, or `globalThis`, through
 * `@clerk/shared/getEnvVariable`. Read it when it is needed, not at import:
 * some runtimes only provide bindings once a request arrives.
 *
 * @internal
 */
export const getEnvVariable = (
  name: string,
  defaultValue = '',
  context: Record<string, any> | undefined = requestRuntime()
): string => getSharedEnvVariable(name, context) || defaultValue;

/** `VITE_<name>` (exposed to the browser by Vite), then `<name>`. */
const getPublicEnvVariable = (name: string, context?: Record<string, any>) =>
  getEnvVariable(`VITE_${name}`, '', context) ||
  getEnvVariable(name, '', context);

export const getPublicEnvVariables = (
  context: Record<string, any> | undefined = requestRuntime()
) => {
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
