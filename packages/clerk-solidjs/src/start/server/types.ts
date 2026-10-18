import type { AuthObject, SessionAuthObject } from '@clerk/backend';
import type {
  AuthenticateRequestOptions,
  AuthOptions,
  RequestState,
  TokenType
} from '@clerk/backend/internal';
import type {
  MultiDomainAndOrProxy,
  SignInFallbackRedirectUrl,
  SignInForceRedirectUrl,
  SignUpFallbackRedirectUrl,
  SignUpForceRedirectUrl
} from '@clerk/shared/types';
import type { FetchEvent } from '@solidjs/start/server';

type LegacyRedirectProps = {
  /** @deprecated Use `signInFallbackRedirectUrl`. Removed in 4.0. */
  afterSignInUrl?: string;
  /** @deprecated Use `signUpFallbackRedirectUrl`. Removed in 4.0. */
  afterSignUpUrl?: string;
};

/**
 * Options for `clerkMiddleware()`. Every `authenticateRequest()` option is
 * accepted and forwarded: `organizationSyncOptions`, `satelliteAutoSync`,
 * `clockSkewInMs`, `jwksCacheTtlInMs`, `skipJwksCache`, `headerType`,
 * `issuer` and the rest. Options not passed come from the `CLERK_*` env.
 */
export type ClerkMiddlewareOptions = Omit<
  AuthenticateRequestOptions,
  | 'acceptsToken'
  | 'apiClient'
  | 'domain'
  | 'isSatellite'
  | 'proxyUrl'
  | 'afterSignInUrl'
  | 'afterSignUpUrl'
> & {
  secretKey?: string;
  machineSecretKey?: string;
} & MultiDomainAndOrProxy &
  SignInForceRedirectUrl &
  SignInFallbackRedirectUrl &
  SignUpForceRedirectUrl &
  SignUpFallbackRedirectUrl &
  LegacyRedirectProps;

/**
 * Returns middleware options for one request, for keys or settings that are
 * only known at request time, such as Cloudflare Workers bindings.
 */
export type ClerkMiddlewareOptionsCallback = (context: {
  url: URL;
  event: FetchEvent;
}) => ClerkMiddlewareOptions | Promise<ClerkMiddlewareOptions>;

/** @deprecated Use `ClerkMiddlewareOptions`. */
export type LoaderOptions = ClerkMiddlewareOptions;

export type AdditionalStateOptions = SignInFallbackRedirectUrl &
  SignUpFallbackRedirectUrl &
  SignInForceRedirectUrl &
  SignUpForceRedirectUrl;

/** Throws the returned Response to redirect, like `redirect()` from @solidjs/router. */
type RedirectFn = (options?: {
  /** Where to come back after signing in; defaults to the current URL. `null` for none. */
  returnBackUrl?: string | URL | null;
}) => Response;

/** The session auth object `auth()` returns, with redirect helpers. */
export type SessionAuthObjectWithRedirect = SessionAuthObject & {
  /**
   * A 307 redirect to sign-in that comes back here afterwards. Throw it from
   * a `"use server"` function or query: `throw auth().redirectToSignIn()`.
   */
  redirectToSignIn: RedirectFn;
  /** Like `redirectToSignIn`, for sign-up. */
  redirectToSignUp: RedirectFn;
};

/** The state of a request authenticated with `acceptsToken: 'any'`. */
export type AnyRequestState = RequestState<TokenType>;

/** @internal What the middleware stores for `auth()`. */
export type ClerkRequestLocals = {
  requestState: AnyRequestState;
  authenticate: (options?: AuthOptions) => AuthObject;
};
