import { deprecated } from '@clerk/shared/deprecated';
import type {
  HandleOAuthCallbackParams,
  PendingSessionOptions,
  ShowWhenCondition
} from '@clerk/shared/types';
import {
  createMemo,
  JSX,
  Match,
  onMount,
  ParentProps,
  Show as SolidShow,
  splitProps,
  Switch
} from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useAssertWrappedByClerkProvider } from '../hooks/use-assert-wrapped-by-clerk-provider';
import { useAuth } from '../hooks/use-auth';
import type {
  RedirectToSignInProps,
  RedirectToSignUpProps,
  RedirectToTasksProps,
  WithClerkProp
} from '../types';
import { withClerk } from './with-clerk';

/** Renders its children once Clerk is `ready` or `degraded`. */
export const ClerkLoaded = (props: ParentProps): JSX.Element => {
  useAssertWrappedByClerkProvider('ClerkLoaded');
  const { loaded } = useClerkLoadState();
  return <SolidShow when={loaded()}>{props.children}</SolidShow>;
};

/**
 * Renders its children while Clerk loads, including during server rendering.
 * They go away once Clerk is ready, degraded or has failed to load.
 */
export const ClerkLoading = (props: ParentProps): JSX.Element => {
  useAssertWrappedByClerkProvider('ClerkLoading');
  const { status } = useClerkLoadState();
  return <SolidShow when={status() === 'loading'}>{props.children}</SolidShow>;
};

/** Renders its children when Clerk failed to load. */
export const ClerkFailed = (props: ParentProps): JSX.Element => {
  useAssertWrappedByClerkProvider('ClerkFailed');
  const { status } = useClerkLoadState();
  return <SolidShow when={status() === 'error'}>{props.children}</SolidShow>;
};

/** Renders its children when Clerk loaded but part of it is not working. */
export const ClerkDegraded = (props: ParentProps): JSX.Element => {
  useAssertWrappedByClerkProvider('ClerkDegraded');
  const { status } = useClerkLoadState();
  return <SolidShow when={status() === 'degraded'}>{props.children}</SolidShow>;
};

export type ShowProps = ParentProps<
  {
    /**
     * `'signed-in'`, `'signed-out'`, an authorization check such as
     * `{ role: 'org:admin' }` or `{ feature: 'premium' }`, or a function
     * that receives `has`.
     */
    when: ShowWhenCondition;
    /** Rendered when `when` does not hold. */
    fallback?: JSX.Element;
  } & PendingSessionOptions
>;

type ShowState = 'loading' | 'authorized' | 'unauthorized';

/**
 * Renders its children when the signed-in state or an authorization check
 * holds, and `fallback` otherwise. It renders nothing until auth has loaded,
 * and its children are created only once they are authorized. A session with
 * pending tasks counts as signed out unless `treatPendingAsSignedOut` is
 * `false`. This is `@clerk/react`'s Core 3 `<Show>`.
 *
 * It shares its name with solid-js's `Show`; import it as `ClerkShow` in a
 * file that uses both.
 *
 * @example
 * <Show when="signed-in" fallback={<SignInButton />}>
 *   <UserButton />
 * </Show>
 *
 * <Show when={{ permission: 'org:billing:manage' }} fallback={<p>Unauthorized</p>}>
 *   <BillingSettings />
 * </Show>
 *
 * <Show when={(has) => has({ role: 'org:admin' }) || isSupportStaff()}>
 *   <AdminPanel />
 * </Show>
 */
export const Show = (props: ShowProps): JSX.Element => {
  useAssertWrappedByClerkProvider('Show');

  const { has, isLoaded, userId } = useAuth(() => ({
    treatPendingAsSignedOut: props.treatPendingAsSignedOut
  }));

  const state = createMemo<ShowState>(() => {
    if (!isLoaded()) return 'loading';
    const when = props.when;
    if (when === 'signed-out') {
      return userId() ? 'unauthorized' : 'authorized';
    }
    if (!userId()) return 'unauthorized';
    if (when === 'signed-in') return 'authorized';
    const authorized = typeof when === 'function' ? when(has) : has(when);
    return authorized ? 'authorized' : 'unauthorized';
  });

  return (
    <Switch>
      <Match when={state() === 'authorized'}>{props.children}</Match>
      <Match when={state() === 'unauthorized'}>{props.fallback}</Match>
    </Switch>
  );
};

/** `Show` under a name that does not collide with solid-js's `Show`. */
export const ClerkShow = Show;

export const RedirectToSignIn = withClerk(
  (props: WithClerkProp<RedirectToSignInProps>) => {
    const [local, redirectToSignInProps] = splitProps(props, ['clerk']);

    // Runs once, like @clerk/react; changing a prop later does not redirect
    // again. onMount does not track what it reads.
    onMount(() => {
      const clerk = local.clerk();
      const hasSignedInSessions =
        (clerk.client?.signedInSessions?.length ?? 0) > 0;
      if (clerk.session === null && hasSignedInSessions) {
        void clerk.redirectToAfterSignOut();
      } else {
        void clerk.redirectToSignIn({ ...redirectToSignInProps });
      }
    });

    return null;
  },
  'RedirectToSignIn'
);

export const RedirectToSignUp = withClerk(
  (props: WithClerkProp<RedirectToSignUpProps>) => {
    const [local, redirectToSignUpProps] = splitProps(props, ['clerk']);
    onMount(() => {
      void local.clerk().redirectToSignUp({ ...redirectToSignUpProps });
    });

    return null;
  },
  'RedirectToSignUp'
);

/**
 * Sends the user to the session's pending tasks, such as choosing an
 * organization, once Clerk has loaded.
 */
export const RedirectToTasks = withClerk(
  (props: WithClerkProp<RedirectToTasksProps>) => {
    const [local, redirectToTasksProps] = splitProps(props, ['clerk']);
    onMount(() => {
      void local.clerk().redirectToTasks({ ...redirectToTasksProps });
    });

    return null;
  },
  'RedirectToTasks'
);

/**
 * @deprecated Use `useClerk()().redirectToUserProfile()`.
 */
export const RedirectToUserProfile = withClerk((props) => {
  onMount(() => {
    deprecated(
      'RedirectToUserProfile',
      'Use the `redirectToUserProfile()` method instead.'
    );
    void props.clerk().redirectToUserProfile();
  });

  return null;
}, 'RedirectToUserProfile');

/**
 * @deprecated Use `useClerk()().redirectToOrganizationProfile()`.
 */
export const RedirectToOrganizationProfile = withClerk((props) => {
  onMount(() => {
    deprecated(
      'RedirectToOrganizationProfile',
      'Use the `redirectToOrganizationProfile()` method instead.'
    );
    void props.clerk().redirectToOrganizationProfile();
  });

  return null;
}, 'RedirectToOrganizationProfile');

/**
 * @deprecated Use `useClerk()().redirectToCreateOrganization()`.
 */
export const RedirectToCreateOrganization = withClerk((props) => {
  onMount(() => {
    deprecated(
      'RedirectToCreateOrganization',
      'Use the `redirectToCreateOrganization()` method instead.'
    );
    void props.clerk().redirectToCreateOrganization();
  });

  return null;
}, 'RedirectToCreateOrganization');

export const AuthenticateWithRedirectCallback = withClerk(
  (props: WithClerkProp<HandleOAuthCallbackParams>) => {
    const [local, handleRedirectCallbackParams] = splitProps(props, ['clerk']);
    onMount(() => {
      void local
        .clerk()
        .handleRedirectCallback({ ...handleRedirectCallbackParams });
    });

    return null;
  },
  'AuthenticateWithRedirectCallback'
);
