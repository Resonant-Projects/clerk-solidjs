import type { SetActiveNavigate } from '@clerk/shared/types';
import { createEffect, JSX, on, untrack } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useSignIn, useSignUp } from '../hooks/use-clerk-signal';

type Flow = 'signIn' | 'signUp';

/** The step that failed, for the diagnostic. */
type Stage =
  'finalize' | 'activate' | 'not_activated' | 'navigation' | 'unexpected';

/**
 * A Clerk error code, such as `network_error`, when the value carries one in
 * that shape. Nothing else from an error is logged: its message, URL or
 * other fields can hold tokens or user data.
 */
const errorCode = (error: unknown): string | undefined => {
  try {
    const code = (error as { code?: unknown } | null | undefined)?.code;
    return typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
};

interface Finalizable {
  readonly createdSessionId?: string | null;
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
  // Set once the user has been sent somewhere, so a failure is not sent
  // again, even when the app's navigation throws.
  let navigatingToApp = false;
  let handedOff = false;
  // The flow of the step in progress, for a step that throws.
  let step: Flow | undefined;

  // Returned, so clerk-js waits for the app's navigation before it
  // publishes the session.
  const toApp = async (...params: Parameters<SetActiveNavigate>) => {
    navigatingToApp = true;
    return props.navigateToApp(...params);
  };

  // Hands the user to the sign-in or sign-up page, once.
  const handOff = (flow: Flow) => {
    handedOff = true;
    step = flow;
    return flow === 'signUp'
      ? props.navigateToSignUp()
      : props.navigateToSignIn();
  };

  // Sends a step that failed back to its flow's page to try again, as a
  // failed Protect challenge does. Never to the app: the session is not
  // active. Once the app's navigation has started, the app owns the route.
  const retry = (flow: Flow) => {
    if (navigatingToApp || handedOff) return;
    return handOff(flow);
  };

  // A fixed diagnostic: the stage, the flow and at most a Clerk error code,
  // never the error itself. A failure that `errors` does not carry is always
  // logged, so it is not lost; one on `errors` in development only.
  const report = (
    stage: Stage,
    flow: Flow,
    error?: unknown,
    onErrors = false
  ) => {
    if (!__DEV__ && onErrors) return;
    const code = errorCode(error);
    console.error(
      `Clerk: HandleSSOCallback could not finish the ${flow} flow: ${stage} failed` +
        (code ? ` (${code}).` : '.')
    );
  };

  // clerk-js's setActive() signs out instead, resolving without an error
  // and without navigating, when its client does not list the session, even
  // after it reloads the client, or does not list it as signed in. Its own
  // check tells it apart from a session that clerk-js activated without our
  // navigation, such as one with a task URL.
  const checkActivated = (sessionId: string | null | undefined, flow: Flow) => {
    if (navigatingToApp || !sessionId) return;
    // signedInSessions, as clerk-js checks after touching the session: an
    // ended or revoked session can stay on `sessions`.
    const listed = untrack(clerk).client?.signedInSessions.some(
      (session) => session.id === sessionId
    );
    if (listed) return;
    report('not_activated', flow);
    return retry(flow);
  };

  // clerk-js returns a failed finalize() as `{ error }` and also sets it on
  // the flow's `errors`, so the sign-in or sign-up page can show it.
  const finalize = async (resource: Finalizable, flow: Flow) => {
    step = flow;
    const sessionId = resource.createdSessionId;
    const { error } = await resource.finalize({ navigate: toApp });
    if (error) {
      report('finalize', flow, error, true);
      return retry(flow);
    }
    return checkActivated(sessionId, flow);
  };

  const run = async (flow: Flow | undefined) => {
    const instance = untrack(clerk);
    try {
      await instance.__internal_resolvePendingProtectCheck?.(flow);
    } catch {
      const failedSignUp = flow
        ? flow === 'signUp'
        : !signIn.protectCheck && !!signUp.protectCheck;
      return handOff(failedSignUp ? 'signUp' : 'signIn');
    }

    // A completed sign-in has nothing left to do. The cast keeps TypeScript
    // from narrowing a status the awaits below can change.
    if ((signIn.status as string) === 'complete') {
      return finalize(signIn, 'signIn');
    }

    // A sign-up for an account that exists becomes a sign-in.
    if (signUp.isTransferable) {
      step = 'signIn';
      await signIn.create({ transfer: true });
      if (signIn.status === 'complete') {
        return finalize(signIn, 'signIn');
      }
      return handOff('signIn');
    }

    if (
      signIn.status === 'needs_first_factor' &&
      !signIn.supportedFirstFactors?.every(
        (factor) => factor.strategy === 'enterprise_sso'
      )
    ) {
      return handOff('signIn');
    }

    // A sign-in with an external account no user has becomes a sign-up.
    if (signIn.isTransferable) {
      step = 'signUp';
      await signUp.create({ transfer: true });
      if (signUp.status === 'complete') {
        return finalize(signUp, 'signUp');
      }
      return handOff('signUp');
    }

    if (signUp.status === 'complete') {
      return finalize(signUp, 'signUp');
    }

    if (
      signIn.status === 'needs_second_factor' ||
      signIn.status === 'needs_new_password'
    ) {
      return handOff('signIn');
    }

    // The external account already belongs to a user with an active session
    // on this client: activate it, which finalize() cannot.
    // setActive() rejects when it fails, for example when clerk-js cannot
    // confirm the session, and there is no `errors` to carry it.
    const signInSessionId = signIn.existingSession?.sessionId;
    const sessionId = signInSessionId || signUp.existingSession?.sessionId;
    if (sessionId) {
      step = signInSessionId ? 'signIn' : 'signUp';
      try {
        await instance.setActive({ session: sessionId, navigate: toApp });
      } catch (error) {
        report('activate', step, error);
        return retry(step);
      }
      return checkActivated(sessionId, step);
    }

    // A sign-up through SSO that still needs fields, such as a username,
    // continues on the sign-up page.
    if (signUp.status === 'missing_requirements') {
      return handOff('signUp');
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
      // Anything else that throws, such as finalize() without a created
      // session, also goes back to the step's flow to try again instead of
      // leaving an unhandled rejection; so does a navigation that throws.
      run(flow).catch((error) => {
        const failed = step ?? flow ?? 'signIn';
        // After a handoff, only the app's navigation callback can throw.
        report(handedOff ? 'navigation' : 'unexpected', failed, error);
        // An async navigation callback can reject instead of throwing.
        const failedNavigation = (navigationError: unknown) =>
          report('navigation', failed, navigationError);
        try {
          void Promise.resolve(retry(failed)).catch(failedNavigation);
        } catch (navigationError) {
          failedNavigation(navigationError);
        }
      });
    })
  );

  return (
    <div>
      <div id="clerk-captcha" />
    </div>
  );
}
