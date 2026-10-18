import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';
import type { ClerkState } from '../types';

/** The init state clerkMiddleware stores for a signed-in request. */
export const signedInInitState = (
  overrides: Partial<ClerkState['__internal_clerk_state']> = {}
) =>
  ({
    __internal_clerk_state: {
      __clerk_ssr_state: {
        sessionId: 'sess_1',
        userId: 'user_1',
        sessionStatus: 'active',
        sessionClaims: { sid: 'sess_1', sub: 'user_1' },
        actor: null,
        orgId: null,
        orgRole: null,
        orgSlug: null,
        orgPermissions: null,
        factorVerificationAge: null
      },
      __publishableKey: TEST_PUBLISHABLE_KEY,
      __proxyUrl: undefined,
      __domain: undefined,
      __isSatellite: false,
      __signInUrl: '/sign-in',
      __signUpUrl: undefined,
      __afterSignInUrl: undefined,
      __afterSignUpUrl: undefined,
      __clerk_debug: null,
      __clerkJSUrl: undefined,
      __clerkJSVersion: undefined,
      __clerkUIUrl: undefined,
      __clerkUIVersion: undefined,
      __prefetchUI: undefined,
      __telemetryDisabled: undefined,
      __telemetryDebug: undefined,
      ...overrides
    }
  }) as unknown as ClerkState;
