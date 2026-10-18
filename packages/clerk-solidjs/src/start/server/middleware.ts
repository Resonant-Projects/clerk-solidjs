import {
  AuthStatus,
  constants,
  createClerkRequest
} from '@clerk/backend/internal';
import { patchRequest } from '@clerk/shared/patchRequest';
import type { RequestMiddleware } from '@solidjs/start/middleware';
import { getRequestEvent } from 'solid-js/web';

import { errorThrower } from '../../errors/error-thrower';
import { createAuthenticate } from './auth';
import { clerkClient } from './clerk-client';
import { loadOptions } from './load-options';
import { CLERK_LOCALS, clerkLocals } from './locals';
import type {
  ClerkMiddlewareOptions,
  ClerkMiddlewareOptionsCallback,
  SessionAuthObjectWithRedirect
} from './types';
import { getResponseClerkState } from './utils';

type FetchEvent = Parameters<RequestMiddleware>[0];

/** The parts of an h3 v2 event this middleware uses. */
type H3EventLike = {
  context?: Record<string, unknown>;
  res?: { headers?: Headers; errHeaders?: Headers };
};

/**
 * A SolidStart middleware that works in both of SolidStart 2's forms: as an
 * h3 `(event, next)` middleware in `createMiddleware([...])`, and in the
 * deprecated `createMiddleware({ onRequest: [...] })` form.
 */
export interface ClerkMiddleware {
  (event: FetchEvent): Promise<Response | void>;
  (event: H3EventLike, next: () => unknown): Promise<unknown>;
}

const appendHeaders = (target: Headers, headers: Headers) => {
  // Append, so several Set-Cookie headers survive.
  headers.forEach((value, key) => target.append(key, value));
};

/**
 * Stages headers for the response h3 builds once the route has run. h3 adds
 * `event.res.headers` to a body and to a Response below 400, and `errHeaders`
 * to an error, a not-found and a Response from 400 up. It uses one or the
 * other, never both, so headers staged on both are added once.
 */
const stageHeaders = (res: H3EventLike['res'], headers: Headers) => {
  if (res?.headers) appendHeaders(res.headers, headers);
  if (res?.errHeaders) appendHeaders(res.errHeaders, headers);
};

/**
 * A copy of the Response with the headers added. Never the route's own
 * object: a Response a route reuses across requests must not keep one
 * visitor's session cookies, and some Responses have immutable headers.
 * Properties set on the Response itself, such as the `crossws` hooks h3's
 * WebSocket handler attaches, carry over. Only string keys: Node 22's
 * Response keeps its state and headers under enumerable symbol keys.
 */
const withHeaders = (response: Response, headers: Headers): Response => {
  const merged = new Headers(response.headers);
  appendHeaders(merged, headers);
  const copy = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged
  });
  for (const key of Object.keys(response)) {
    (copy as unknown as Record<string, unknown>)[key] = (
      response as unknown as Record<string, unknown>
    )[key];
  }
  return copy;
};

/**
 * Authenticates each request with Clerk. It stores the session auth object
 * in `event.locals.auth`, makes `auth()` work for the rest of the request,
 * hands the auth state to the browser, and adds Clerk's response headers
 * (session-refresh cookies and `x-clerk-auth-*` diagnostics). Requests with
 * an API key, M2M or OAuth token are authenticated too; read them with
 * `auth({ acceptsToken })`.
 *
 * Options not passed come from the `CLERK_*` env, read per request. Pass a
 * function to compute them per request, for example from runtime bindings.
 *
 * @example
 * // src/middleware.ts
 * import { createMiddleware } from '@solidjs/start/middleware';
 * import { clerkMiddleware } from '@resonant-projects/clerk-solidjs/start/server';
 *
 * export default createMiddleware([clerkMiddleware()]);
 *
 * @example
 * // The deprecated object form still works.
 * export default createMiddleware({ onRequest: [clerkMiddleware()] });
 */
export const clerkMiddleware = (
  options?: ClerkMiddlewareOptions | ClerkMiddlewareOptionsCallback
): ClerkMiddleware => {
  /** Authenticates and fills `locals`; returns a handshake redirect or the headers to add. */
  const authenticate = async (
    event: FetchEvent
  ): Promise<{ redirect: Response } | { headers: Headers }> => {
    const clerkRequest = createClerkRequest(patchRequest(event.request));
    const resolvedOptions =
      typeof options === 'function'
        ? await options({ url: clerkRequest.clerkUrl, event })
        : options;
    const loadedOptions = loadOptions(clerkRequest, resolvedOptions);

    const requestState = await clerkClient({
      secretKey: loadedOptions.secretKey,
      machineSecretKey: loadedOptions.machineSecretKey,
      publishableKey: loadedOptions.publishableKey,
      jwtKey: loadedOptions.jwtKey,
      // Fixed when the client is built: authenticateRequest() ignores both.
      apiUrl: loadedOptions.apiUrl,
      apiVersion: loadedOptions.apiVersion,
      domain: loadedOptions.domain,
      proxyUrl: loadedOptions.proxyUrl,
      isSatellite: loadedOptions.isSatellite
    }).authenticateRequest(clerkRequest, {
      ...loadedOptions,
      acceptsToken: 'any'
    });

    if (requestState.headers.get(constants.Headers.Location)) {
      return {
        redirect: new Response(null, {
          status: 307,
          headers: requestState.headers
        })
      };
    }
    if (requestState.status === AuthStatus.Handshake) {
      throw errorThrower.throw('Clerk: handshake status without redirect');
    }

    const authenticateFn = createAuthenticate(clerkRequest, requestState);
    const locals = clerkLocals(event.locals);
    locals[CLERK_LOCALS] = { requestState, authenticate: authenticateFn };
    // The session object, as before, even when a machine token authenticated
    // the request: those are only returned by auth({ acceptsToken }).
    locals.auth = authenticateFn() as SessionAuthObjectWithRedirect;
    locals.clerkInitialState = getResponseClerkState(
      requestState,
      loadedOptions
    ).clerkInitialState;
    return { headers: requestState.headers };
  };

  async function middleware(
    event: FetchEvent | H3EventLike,
    next?: () => unknown
  ): Promise<unknown> {
    if (typeof next !== 'function') {
      // createMiddleware({ onRequest }) passes the FetchEvent alone.
      const fetchEvent = event as FetchEvent;
      const result = await authenticate(fetchEvent);
      if ('redirect' in result) return result.redirect;
      // SolidStart's FetchEvent.response is h3's event.res.
      stageHeaders(fetchEvent.response as H3EventLike['res'], result.headers);
      return;
    }

    // An h3 v2 middleware: SolidStart provides the FetchEvent while it runs.
    const h3Event = event as H3EventLike;
    const fetchEvent =
      (getRequestEvent() as FetchEvent | undefined) ??
      (h3Event.context?.solidFetchEvent as FetchEvent | undefined);
    if (!fetchEvent) {
      throw errorThrower.throw(
        'clerkMiddleware() needs SolidStart: register it with createMiddleware() from @solidjs/start/middleware.'
      );
    }
    const result = await authenticate(fetchEvent);
    if ('redirect' in result) return result.redirect;

    const res = h3Event.res ?? (fetchEvent.response as H3EventLike['res']);
    let response: unknown;
    try {
      response = await next();
    } catch (error) {
      stageHeaders(res, result.headers);
      throw error;
    }
    // A Response gets them itself, so h3 adds nothing twice. Anything else
    // (a body, an error, nothing, h3's not-found) becomes a response later.
    if (response instanceof Response) {
      return withHeaders(response, result.headers);
    }
    stageHeaders(res, result.headers);
    return response;
  }

  return middleware as ClerkMiddleware;
};
