import type { SignInProps } from '@clerk/shared/types';
import { splitProps } from 'solid-js';
import { usePortalRoot } from '../contexts/portal';
import type { SignInButtonProps, WithClerkProp } from '../types';
import { ClerkButton } from '../utils';
import { withClerk } from './with-clerk';

/**
 * Opens sign-in in a modal (`mode="modal"`) or redirects to it. Renders the
 * default button, or your own element passed as its only child. It renders on
 * the server and before Clerk loads; a click before load runs once it has.
 */
export const SignInButton = withClerk(
  (props: WithClerkProp<SignInButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props as WithClerkProp<SignInButtonProps> & {
        appearance?: SignInProps['appearance'];
      },
      ['children', 'onClick'],
      [
        'clerk',
        'mode',
        'appearance',
        'fallbackRedirectUrl',
        'forceRedirectUrl',
        'signUpFallbackRedirectUrl',
        'signUpForceRedirectUrl',
        'initialValues',
        'withSignUp',
        'oauthFlow'
      ]
    );
    // Modals open in an UNSAFE_PortalProvider's container, if any.
    const getContainer = usePortalRoot();

    const signIn = () => {
      const opts: SignInProps = {
        fallbackRedirectUrl: clerkProps.fallbackRedirectUrl,
        forceRedirectUrl: clerkProps.forceRedirectUrl,
        signUpFallbackRedirectUrl: clerkProps.signUpFallbackRedirectUrl,
        signUpForceRedirectUrl: clerkProps.signUpForceRedirectUrl,
        initialValues: clerkProps.initialValues,
        withSignUp: clerkProps.withSignUp,
        oauthFlow: clerkProps.oauthFlow
      };
      if (clerkProps.mode === 'modal') {
        return clerkProps.clerk().openSignIn({
          ...opts,
          appearance: clerkProps.appearance,
          getContainer
        });
      }
      return clerkProps.clerk().redirectToSignIn({
        ...opts,
        signInFallbackRedirectUrl: clerkProps.fallbackRedirectUrl,
        signInForceRedirectUrl: clerkProps.forceRedirectUrl
      });
    };

    return (
      <ClerkButton
        name="SignInButton"
        defaultText="Sign in"
        attributes={rest}
        onClick={local.onClick}
        action={signIn}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'SignInButton', renderWhileLoading: true }
);
