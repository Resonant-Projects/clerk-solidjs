import type { DeriveStateReturnType } from '@clerk/shared/deriveState';
import { Accessor, createMemo } from 'solid-js';
import { createContextProviderAndHook } from '../utils/create-context-provider-and-hook';

/**
 * The auth fields `deriveState` produces from clerk-js or from the server's
 * initial state. `undefined` means not loaded yet; `null` means signed out
 * or not applicable.
 */
export type AuthState = Pick<
  DeriveStateReturnType,
  | 'userId'
  | 'sessionId'
  | 'sessionStatus'
  | 'sessionClaims'
  | 'factorVerificationAge'
  | 'actor'
  | 'orgId'
  | 'orgRole'
  | 'orgSlug'
  | 'orgPermissions'
>;

type AuthContextValue = { [K in keyof AuthState]: Accessor<AuthState[K]> };

export const [AuthContextProvider, useAuthContext] =
  createContextProviderAndHook(
    'AuthContext',
    (props: { auth: Accessor<AuthState> }): AuthContextValue => {
      // One memo per field, so consumers re-run only when their field changes
      // rather than on every Clerk update.
      const field = <K extends keyof AuthState>(key: K) =>
        createMemo(() => props.auth()[key]);

      return {
        userId: field('userId'),
        sessionId: field('sessionId'),
        sessionStatus: field('sessionStatus'),
        sessionClaims: field('sessionClaims'),
        factorVerificationAge: field('factorVerificationAge'),
        actor: field('actor'),
        orgId: field('orgId'),
        orgRole: field('orgRole'),
        orgSlug: field('orgSlug'),
        orgPermissions: field('orgPermissions')
      };
    }
  );
