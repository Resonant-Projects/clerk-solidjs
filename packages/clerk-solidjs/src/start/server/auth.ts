import type { AuthObject } from '@clerk/backend';
import type {
  AuthOptions,
  ClerkRequest,
  GetAuthFnNoRequest
} from '@clerk/backend/internal';
import {
  constants,
  createRedirect,
  getAuthObjectForAcceptedToken,
  TokenType
} from '@clerk/backend/internal';
import { getRequestEvent } from 'solid-js/web';

import { errorThrower } from '../../errors/error-thrower';
import {
  authCalledOutsideRequest,
  clerkMiddlewareNotConfigured
} from '../../errors/messages';
import type { AnyRequestState, SessionAuthObjectWithRedirect } from './types';

/** A redirect `redirect()` from @solidjs/router would also build. */
const redirectResponse = (url: string) =>
  new Response(null, { status: 307, headers: { Location: url } });

/**
 * Builds the function `auth()` calls for one request: it resolves the token
 * type the caller accepts, and gives session auth objects redirect helpers.
 *
 * @internal
 */
export const createAuthenticate = (
  clerkRequest: ClerkRequest,
  requestState: AnyRequestState
) => {
  const addRedirects = (
    authObject: AuthObject
  ): SessionAuthObjectWithRedirect | AuthObject => {
    if (authObject.tokenType !== TokenType.SessionToken) return authObject;
    const redirectTo =
      (kind: 'redirectToSignIn' | 'redirectToSignUp') =>
      (options: { returnBackUrl?: string | URL | null } = {}) => {
        const devBrowserToken =
          clerkRequest.clerkUrl.searchParams.get(
            constants.QueryParameters.DevBrowser
          ) || clerkRequest.cookies.get(constants.Cookies.DevBrowser);
        return createRedirect({
          redirectAdapter: redirectResponse,
          devBrowserToken,
          baseUrl: clerkRequest.clerkUrl.toString(),
          publishableKey: requestState.publishableKey,
          signInUrl: requestState.signInUrl,
          signUpUrl: requestState.signUpUrl,
          sessionStatus: authObject.sessionStatus,
          isSatellite: requestState.isSatellite
        })[kind]({
          returnBackUrl:
            options.returnBackUrl === null
              ? ''
              : options.returnBackUrl || clerkRequest.clerkUrl.toString()
        });
      };
    return Object.assign(authObject, {
      redirectToSignIn: redirectTo('redirectToSignIn'),
      redirectToSignUp: redirectTo('redirectToSignUp')
    });
  };

  return ({ acceptsToken, treatPendingAsSignedOut }: AuthOptions = {}) =>
    addRedirects(
      getAuthObjectForAcceptedToken({
        // Not a handshake (the middleware redirects those), so never null.
        authObject: requestState.toAuth({
          treatPendingAsSignedOut
        }) as AuthObject,
        acceptsToken
      })
    );
};

/**
 * The auth object for the current request. Call it on the server, inside a
 * `"use server"` function or query, an API route or middleware that runs
 * after `clerkMiddleware()`.
 *
 * By default it returns the session auth object, with `redirectToSignIn()`
 * and `redirectToSignUp()`. A session with pending tasks counts as signed
 * out unless `treatPendingAsSignedOut` is `false`. Pass `acceptsToken` to
 * accept machine tokens (`'api_key'`, `'m2m_token'`, `'oauth_token'`), an
 * array of them, or `'any'`.
 *
 * @example
 * const getUser = query(async () => {
 *   'use server';
 *   const { userId, redirectToSignIn } = auth();
 *   if (!userId) throw redirectToSignIn();
 *   return clerkClient().users.getUser(userId);
 * }, 'user');
 *
 * @example
 * export function GET() {
 *   const { isAuthenticated, userId } = auth({ acceptsToken: 'api_key' });
 *   if (!isAuthenticated) return new Response(null, { status: 401 });
 *   // ...
 * }
 */
export const auth = ((options?: AuthOptions) => {
  const event = getRequestEvent();
  if (!event) {
    return errorThrower.throw(authCalledOutsideRequest);
  }
  const clerk = event.locals.clerk;
  if (!clerk) {
    return errorThrower.throw(clerkMiddlewareNotConfigured);
  }
  return clerk.authenticate(options);
}) as GetAuthFnNoRequest<SessionAuthObjectWithRedirect, false>;

/** @deprecated Use `typeof auth`. */
export type AuthHelper = typeof auth;
