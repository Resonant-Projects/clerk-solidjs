import type { SetActiveNavigate } from '@clerk/shared/types';
import { createEffect, JSX, on, untrack } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useSignIn, useSignUp } from '../hooks/use-clerk-signal';

type Flow = 'signIn' | 'signUp';

interface Finalizable {
  finalize: (params: {
    navigate: SetActiveNavigate;
  }) => Promise<{ error: unknown }>;
}

export interface HandleSSOCallbackProps {
  /** Called with `finalize()`'s navigation once the user is signed in. */
  navigateToApp: (...params: Parameters<SetActiveNavigate>) => void;
  /**
   * Called when the sign-in needs another step, such as a second factor, or
   * when it fails: a failed Protect challenge or a sign-in that cannot be
   * activated. A failed `finalize()` leaves its error on `errors` from
   * `useSignIn()`.
   */
  navigateToSignIn: () => void;
  /**
   * Called when the sign-up needs another step, or when it fails, as for
   * `navigateToSignIn`, with the error on `errors` from `useSignUp()`.
   */
  navigateToSignUp: () => void;
}

/**
 * Finishes an SSO sign-in or sign-up on the route an OAuth or enterprise SSO
 * provider redirects back to, with the Core 3 resources, as `@clerk/react`'s
 * does. It resolves a pending bot-protection check, then finalizes the
 * sign-in or sign-up, transfers between them when the account exists or does
 * not, or hands off to your sign-in or sign-up page for another step. If a
 * step fails, for example when clerk-js cannot confirm the new session, it
 * sends the user back to the sign-in or sign-up page to try again rather than
 * leaving them on the callback route. It runs once, when Clerk has loaded,
 * and renders the CAPTCHA element a transferred sign-up may need.
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
  let navigatingToApp = false;

  // Returned, so clerk-js waits for the app's navigation before it
  // publishes the session.
  const toApp = async (...params: Parameters<SetActiveNavigate>) => {
    navigatingToApp = true;
    return props.navigateToApp(...params);
  };

  // Sends a step that failed back to its flow's page to try again, as a
  // failed Protect challenge does. Never to the app: the session is not
  // active. Once the app's navigation has started, the app owns the route.
  const retry = (flow: Flow) => {
    if (navigatingToApp) return;
    return flow === 'signUp'
      ? props.navigateToSignUp()
      : props.navigateToSignIn();
  };

  const report = (error: unknown) => {
    if (__DEV__) {
      console.error('Clerk: HandleSSOCallback could not finish:', error);
    }
  };

  // clerk-js returns a failed finalize() as `{ error }` and also sets it on
  // the flow's `errors`, so the sign-in or sign-up page can show it.
  const finalize = async (resource: Finalizable, flow: Flow) => {
    const { error } = await resource.finalize({ navigate: toApp });
    if (error) {
      report(error);
      return retry(flow);
    }
  };

  const run = async (flow: Flow | undefined) => {
    const instance = untrack(clerk);
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
      return finalize(signIn, 'signIn');
    }

    // A sign-up for an account that exists becomes a sign-in.
    if (signUp.isTransferable) {
      await signIn.create({ transfer: true });
      if (signIn.status === 'complete') {
        return finalize(signIn, 'signIn');
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
        return finalize(signUp, 'signUp');
      }
      return props.navigateToSignUp();
    }

    if (signUp.status === 'complete') {
      return finalize(signUp, 'signUp');
    }

    if (
      signIn.status === 'needs_second_factor' ||
      signIn.status === 'needs_new_password'
    ) {
      return props.navigateToSignIn();
    }

    // The external account already belongs to a user with an active session
    // on this client: activate it, which finalize() cannot.
    // setActive() rejects when it fails, for example when clerk-js cannot
    // confirm the session, and there is no `errors` to carry it.
    const signInSessionId = signIn.existingSession?.sessionId;
    const sessionId = signInSessionId || signUp.existingSession?.sessionId;
    if (sessionId) {
      try {
        await instance.setActive({ session: sessionId, navigate: toApp });
      } catch (error) {
        report(error);
        return retry(signInSessionId ? 'signIn' : 'signUp');
      }
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
      const intent = new URLSearchParams(window.location.search).get('intent');
      const flow =
        intent === 'signIn' || intent === 'signUp' ? intent : undefined;
      // Anything else that throws, such as a transfer request, also goes back
      // to try again instead of leaving an unhandled rejection.
      run(flow).catch((error) => {
        report(error);
        retry(flow ?? 'signIn');
      });
    })
  );

  return (
    <div>
      <div id="clerk-captcha" />
    </div>
  );
}
