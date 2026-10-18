import {
  createCheckAuthorization,
  resolveAuthState
} from '@clerk/shared/authorization';
import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  CheckAuthorizationWithCustomPermissions,
  GetToken,
  PendingSessionOptions,
  SignOut
} from '@clerk/shared/types';
import { Accessor, createEffect, createMemo, on, untrack } from 'solid-js';
import { useAuthContext } from '../contexts/auth';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { errorThrower } from '../errors/error-thrower';
import { invalidStateError } from '../errors/messages';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { createGetToken, createSignOut } from './utils';

export type UseAuthOptions = PendingSessionOptions;

type HasParams = Parameters<CheckAuthorizationWithCustomPermissions>[0];

/**
 * The current auth state, as accessors. It matches `@clerk/react`'s `useAuth`:
 * a session with pending tasks counts as signed out unless
 * `treatPendingAsSignedOut` is `false`, and `has()` checks roles,
 * permissions, features, plans and reverification together, returning
 * `false` for anything it cannot confirm.
 *
 * @example
 * const { isSignedIn, userId, has } = useAuth();
 * const canManage = () => has({ permission: 'org:sys_memberships:manage' });
 */
export const useAuth = (
  options?: UseAuthOptions | Accessor<UseAuthOptions | undefined>
) => {
  useAssertWrappedByClerkProvider('useAuth');

  const auth = useAuthContext();
  const isomorphicClerk = useIsomorphicClerkContext();

  const getToken: GetToken = createGetToken(isomorphicClerk);
  const signOut: SignOut = createSignOut(isomorphicClerk);

  const treatPendingAsSignedOut = () =>
    (typeof options === 'function' ? options() : options)
      ?.treatPendingAsSignedOut ?? true;

  createEffect(
    on(
      () => isomorphicClerk().telemetry,
      (telemetry) =>
        telemetry?.record(
          eventMethodCalled('useAuth', {
            treatPendingAsSignedOut: untrack(() =>
              typeof options === 'function'
                ? options()?.treatPendingAsSignedOut
                : options?.treatPendingAsSignedOut
            )
          })
        )
    )
  );

  const checkAuthorization = createMemo(() =>
    createCheckAuthorization({
      userId: auth.userId(),
      orgId: auth.orgId(),
      orgRole: auth.orgRole(),
      orgPermissions: auth.orgPermissions(),
      factorVerificationAge: auth.factorVerificationAge(),
      features: (auth.sessionClaims()?.fea as string) || '',
      plans: (auth.sessionClaims()?.pla as string) || ''
    })
  );

  const payload = createMemo(() => {
    const resolved = resolveAuthState({
      authObject: {
        sessionId: auth.sessionId(),
        sessionStatus: auth.sessionStatus(),
        sessionClaims: auth.sessionClaims(),
        userId: auth.userId(),
        actor: auth.actor(),
        orgId: auth.orgId(),
        orgRole: auth.orgRole(),
        orgSlug: auth.orgSlug(),
        orgPermissions: auth.orgPermissions(),
        getToken,
        signOut,
        has: (params) => checkAuthorization()(params)
      },
      options: { treatPendingAsSignedOut: treatPendingAsSignedOut() }
    });
    if (!resolved) {
      return errorThrower.throw(invalidStateError);
    }
    return resolved;
  });

  const isLoaded = createMemo(() => payload().isLoaded);
  const isSignedIn = createMemo(() => payload().isSignedIn);
  const sessionId = createMemo(() => payload().sessionId);
  const sessionClaims = createMemo(() => payload().sessionClaims);
  const userId = createMemo(() => payload().userId);
  const actor = createMemo(() => payload().actor);
  const orgId = createMemo(() => payload().orgId);
  const orgRole = createMemo(() => payload().orgRole);
  const orgSlug = createMemo(() => payload().orgSlug);
  // Not in @clerk/react; kept for existing apps. Follows the signed-in state,
  // so a pending session reports no permissions.
  const orgPermissions = createMemo(() => {
    if (!isLoaded()) return undefined;
    return isSignedIn() ? (auth.orgPermissions() ?? null) : null;
  });

  /** Reactive when called inside a tracked scope. */
  const has = (params: HasParams) => payload().has(params);

  return {
    isLoaded,
    isSignedIn,
    sessionId,
    sessionClaims,
    userId,
    actor,
    orgId,
    orgRole,
    orgSlug,
    orgPermissions,
    has,
    signOut,
    getToken
  };
};
