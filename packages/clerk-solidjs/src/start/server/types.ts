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
import type { ContentSecurityPolicyOptions } from './content-security-policy';

export type {
  ContentSecurityPolicyDirective,
  ContentSecurityPolicyOptions
} from './content-security-policy';

/** Proxies Clerk's Frontend API through this app. */
export type FrontendApiProxyOptions = {
  /** `true`, or a function of the request URL that decides per request. */
  enabled: boolean | ((url: URL) => boolean);
  /** The path the proxy serves. Defaults to `/__clerk`. */
  path?: string;
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
  /**
   * Logs the options, the request, the request state and the auth object
   * for each request, with keys, tokens and cookies cut short.
   */
  debug?: boolean;
  /**
   * Sets a Content-Security-Policy that allows Clerk, merged with your
   * directives. In strict mode the nonce is in `event.locals.clerkNonce`.
   */
  contentSecurityPolicy?: ContentSecurityPolicyOptions;
  /**
   * Serves Clerk's Frontend API from this app, at `/__clerk` by default,
   * for networks that block it. The browser uses it too: without a
   * `proxyUrl`, the proxy's URL becomes the proxy URL.
   */
  frontendApiProxy?: FrontendApiProxyOptions;
} & MultiDomainAndOrProxy &
  SignInForceRedirectUrl &
  SignInFallbackRedirectUrl &
  SignUpForceRedirectUrl &
  SignUpFallbackRedirectUrl;

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
