import type { ClerkClient, ClerkOptions } from '@clerk/backend';
import { createClerkClient } from '@clerk/backend';

import { commonEnvs } from './constants';

/**
 * A Clerk Backend API client configured from the env, read when it is called.
 * Options override the env.
 *
 * @example
 * const user = await clerkClient().users.getUser(userId);
 */
export const clerkClient = (options?: ClerkOptions): ClerkClient => {
  const env = commonEnvs();
  return createClerkClient({
    secretKey: env.SECRET_KEY,
    machineSecretKey: env.MACHINE_SECRET_KEY,
    publishableKey: env.PUBLISHABLE_KEY,
    apiUrl: env.API_URL,
    apiVersion: env.API_VERSION,
    userAgent: `${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    proxyUrl: env.PROXY_URL,
    domain: env.DOMAIN,
    isSatellite: env.IS_SATELLITE,
    sdkMetadata: env.SDK_METADATA,
    telemetry: {
      disabled: env.TELEMETRY_DISABLED,
      debug: env.TELEMETRY_DEBUG
    },
    ...options
  });
};
