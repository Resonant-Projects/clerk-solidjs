import type { ForPayerType } from '@clerk/shared/types';
import { createMemo } from 'solid-js';
import { useAuth } from '../../hooks/use-auth';

/**
 * @clerk/react's guards for the billing buttons, kept current: a signed-out
 * user, or `for="organization"` without an active organization, is an error
 * the nearest ErrorBoundary catches. While Clerk loads, neither is known, so
 * neither throws. Read the returned accessor in the button's JSX.
 *
 * @internal
 */
export const useBillingGuards = (
  component: string,
  payer: () => ForPayerType | undefined
) => {
  const auth = useAuth();
  return createMemo(() => {
    if (auth.userId() === null) {
      throw new Error(
        `Clerk: Ensure that \`<${component} />\` is rendered only when the user is signed in (wrap with \`<Show when="signed-in">\` or guard with \`useAuth()\`).`
      );
    }
    if (auth.orgId() === null && payer() === 'organization') {
      throw new Error(
        `Clerk: Wrap \`<${component} for="organization" />\` with a check for an active organization. Retrieve \`orgId\` from \`useAuth()\` and confirm it is defined.`
      );
    }
    return true;
  });
};
