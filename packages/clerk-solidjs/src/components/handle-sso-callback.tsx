import type { SetActiveNavigate } from '@clerk/shared/types';
import { createEffect, JSX, on, untrack } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useSignIn, useSignUp } from '../hooks/use-clerk-signal';

export interface HandleSSOCallbackProps {
  /** Called with `finalize()`'s navigation once the user is signed in. */
  navigateToApp: (...params: Parameters<SetActiveNavigate>) => void;
  /** Called when the sign-in needs another step, such as a second factor. */
  navigateToSignIn: () => void;
  /** Called when the sign-up needs another step. */
  navigateToSignUp: () => void;
}

/**
 * Finishes an SSO sign-in or sign-up on the route an OAuth or enterprise SSO
 * provider redirects back to, with the Core 3 resources, as `@clerk/react`'s
 * does. It resolves a pending bot-protection check, then finalizes the
 * sign-in or sign-up, transfers between them when the account exists or does
 * not, or hands off to your sign-in or sign-up page for another step. It runs
 * once, when Clerk has loaded, and renders the CAPTCHA element a transferred
 * sign-up may need.
 *
 * @example
 * // src/routes/sso-callback.tsx
 * export default function SSOCallback() {
 *   const navigate = useNavigate();
 *   return (
 *     <HandleSSOCallback
 *       navigateToApp={({ decorateUrl }) => {
 *         // For Safari's cookie cap, decorateUrl can return a Clerk URL.
 *         const url = decorateUrl('/');
 *         if (url.startsWith('http')) window.location.href = url;
 *         else navigate(url);
 *       }}
 *       navigateToSignIn={() => navigate('/sign-in')}
 *       navigateToSignUp={() => navigate('/sign-up')}
 *     />
 *   );
 * }
 */
export function HandleSSOCallback(props: HandleSSOCallbackProps): JSX.Element {
  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  // Live views: their status is current after each await below.
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  let hasRun = false;

  // Returned, so clerk-js waits for the app's navigation before it
  // publishes the session.
  const toApp = async (...params: Parameters<SetActiveNavigate>) =>
    props.navigateToApp(...params);

  const run = async () => {
    const instance = untrack(clerk);
    const intent = new URLSearchParams(window.location.search).get('intent');
    const flow =
      intent === 'signIn' || intent === 'signUp' ? intent : undefined;
    try {
      await instance.__internal_resolvePendingProtectCheck?.(flow);
    } catch {
      const failedSignUp = flow
        ? flow === 'signUp'
        : !signIn.protectCheck && !!signUp.protectCheck;
      return failedSignUp ? props.navigateToSignUp() : props.navigateToSignIn();
    }

    // A completed sign-in has nothing left to do. The cast keeps TypeScript
    // from narrowing a status the awaits below can change.
    if ((signIn.status as string) === 'complete') {
      await signIn.finalize({ navigate: toApp });
      return;
    }

    // A sign-up for an account that exists becomes a sign-in.
    if (signUp.isTransferable) {
      await signIn.create({ transfer: true });
      if (signIn.status === 'complete') {
        await signIn.finalize({ navigate: toApp });
        return;
      }
      return props.navigateToSignIn();
    }

    if (
      signIn.status === 'needs_first_factor' &&
      !signIn.supportedFirstFactors?.every(
        (factor) => factor.strategy === 'enterprise_sso'
      )
    ) {
      return props.navigateToSignIn();
    }

    // A sign-in with an external account no user has becomes a sign-up.
    if (signIn.isTransferable) {
      await signUp.create({ transfer: true });
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate: toApp });
        return;
      }
      return props.navigateToSignUp();
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: toApp });
      return;
    }

    if (
      signIn.status === 'needs_second_factor' ||
      signIn.status === 'needs_new_password'
    ) {
      return props.navigateToSignIn();
    }

    // The external account already belongs to a user with an active session
    // on this client: activate it, which finalize() cannot.
    const sessionId =
      signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
    if (sessionId) {
      await instance.setActive({ session: sessionId, navigate: toApp });
      return;
    }

    // A sign-up through SSO that still needs fields, such as a username,
    // continues on the sign-up page.
    if (signUp.status === 'missing_requirements') {
      return props.navigateToSignUp();
    }
  };

  createEffect(
    on(loaded, (isLoaded) => {
      if (!isLoaded || hasRun) return;
      // Once, even if the page renders again while the session activates.
      hasRun = true;
      void run();
    })
  );

  return (
    <div>
      <div id="clerk-captcha" />
    </div>
  );
}
