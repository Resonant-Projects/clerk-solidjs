import type { ForPayerType } from '@clerk/shared/types';
import { Accessor } from 'solid-js';
import { useClerkLoadState } from '../../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useOrganizationContext } from '../../contexts/organization';
import { useUserContext } from '../../contexts/user';

/**
 * Whether billing is on for the payer, as `@clerk/shared`'s hook: the
 * instance has user or organization billing turned on, Clerk has loaded,
 * and, unless `authenticated` is `false`, a user (and for an organization, an
 * active one) is signed in.
 *
 * @internal
 */
export const useBillingIsEnabled = (
  params: Accessor<{
    for?: ForPayerType;
    enabled?: boolean;
    authenticated?: boolean;
  }>
): Accessor<boolean> => {
  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  const user = useUserContext();
  const organization = useOrganizationContext();

  return () => {
    const { for: payer, enabled = true, authenticated = true } = params();
    const billing = clerk().__internal_environment?.commerceSettings.billing;
    const billingEnabled =
      payer === 'organization'
        ? billing?.organization.enabled
        : payer === 'user'
          ? billing?.user.enabled
          : billing?.user.enabled || billing?.organization.enabled;
    const signedIn = authenticated
      ? (payer === 'organization' ? !!organization()?.id : true) && !!user()?.id
      : true;
    return !!billingEnabled && enabled && loaded() && signedIn;
  };
};
