import {
  createCheckAuthorization,
  resolveAuthState
} from '@clerk/shared/authorization';
import type {
  CheckAuthorizationWithCustomPermissions,
  JwtPayload,
  PendingSessionOptions
} from '@clerk/shared/types';
import { type Accessor, createMemo } from 'solid-js';
import { errorThrower } from '../errors/error-thrower';
import { invalidStateError } from '../errors/messages';

type HasParams = Parameters<CheckAuthorizationWithCustomPermissions>[0];

/**
 * `useAuth`'s state for an auth object you have, as
 * `@clerk/react/internal`'s `useDerivedAuth`: for a framework SDK that gets
 * auth from somewhere other than ClerkProvider. `has` checks the object's
 * claims unless the object brings its own. Pass the object as an accessor;
 * the result is a memo.
 *
 * @internal
 */
export const useDerivedAuth = (
  authObject: Accessor<any>,
  options?: PendingSessionOptions | Accessor<PendingSessionOptions | undefined>
) =>
  createMemo(() => {
    const object = authObject() ?? {};
    const { treatPendingAsSignedOut = true } =
      (typeof options === 'function' ? options() : options) ?? {};
    const {
      userId,
      orgId,
      orgRole,
      has,
      orgPermissions,
      factorVerificationAge,
      sessionClaims
    } = object;

    const derivedHas = (params: HasParams) =>
      has
        ? has(params)
        : createCheckAuthorization({
            userId,
            orgId,
            orgRole,
            orgPermissions,
            factorVerificationAge,
            features:
              ((sessionClaims as JwtPayload | undefined)?.fea as string) || '',
            plans:
              ((sessionClaims as JwtPayload | undefined)?.pla as string) || ''
          })(params);

    const payload = resolveAuthState({
      authObject: { ...object, has: derivedHas },
      options: { treatPendingAsSignedOut }
    });
    if (!payload) {
      return errorThrower.throw(invalidStateError);
    }
    return payload;
  });
