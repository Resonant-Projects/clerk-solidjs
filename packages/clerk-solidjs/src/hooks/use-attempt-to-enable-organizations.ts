import { Accessor, createEffect, untrack } from 'solid-js';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';

/**
 * Asks Clerk once to offer turning organizations on, which a development
 * instance without them answers with the enable-organizations prompt, as
 * `@clerk/shared` does. IsomorphicClerk waits for clerk-js; the server never
 * asks. An older clerk-js without the method is skipped.
 *
 * @internal
 */
export const useAttemptToEnableOrganizations = (
  caller: 'useOrganization' | 'useOrganizationList',
  enabled: Accessor<boolean>
) => {
  const clerk = useIsomorphicClerkContext();
  let attempted = false;
  createEffect(() => {
    if (attempted || !enabled()) return;
    attempted = true;
    untrack(clerk).__internal_attemptToEnableEnvironmentSetting?.({
      for: 'organizations',
      caller
    });
  });
};
