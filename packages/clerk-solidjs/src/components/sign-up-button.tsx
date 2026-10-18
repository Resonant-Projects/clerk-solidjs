import type { SignUpProps } from '@clerk/shared/types';
import { splitProps } from 'solid-js';
import { usePortalRoot } from '../contexts/portal';
import type { SignUpButtonProps, WithClerkProp } from '../types';
import { ClerkButton } from '../utils';
import { withClerk } from './with-clerk';

/**
 * Opens sign-up in a modal (`mode="modal"`) or redirects to it. Renders the
 * default button, or your own element passed as its only child. It renders on
 * the server and before Clerk loads; a click before load runs once it has.
 */
export const SignUpButton = withClerk(
  (props: WithClerkProp<SignUpButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props as WithClerkProp<SignUpButtonProps> & {
        appearance?: SignUpProps['appearance'];
      },
      ['children', 'onClick'],
      [
        'clerk',
        'mode',
        'appearance',
        'unsafeMetadata',
        'fallbackRedirectUrl',
        'forceRedirectUrl',
        'signInFallbackRedirectUrl',
        'signInForceRedirectUrl',
        'initialValues',
        'oauthFlow'
      ]
    );
    // Modals open in an UNSAFE_PortalProvider's container, if any.
    const getContainer = usePortalRoot();

    const signUp = () => {
      const opts: SignUpProps = {
        fallbackRedirectUrl: clerkProps.fallbackRedirectUrl,
        forceRedirectUrl: clerkProps.forceRedirectUrl,
        signInFallbackRedirectUrl: clerkProps.signInFallbackRedirectUrl,
        signInForceRedirectUrl: clerkProps.signInForceRedirectUrl,
        initialValues: clerkProps.initialValues,
        oauthFlow: clerkProps.oauthFlow
      };
      if (clerkProps.mode === 'modal') {
        return clerkProps.clerk().openSignUp({
          ...opts,
          appearance: clerkProps.appearance,
          unsafeMetadata: clerkProps.unsafeMetadata,
          getContainer
        });
      }
      return clerkProps.clerk().redirectToSignUp({
        ...opts,
        signUpFallbackRedirectUrl: clerkProps.fallbackRedirectUrl,
        signUpForceRedirectUrl: clerkProps.forceRedirectUrl
      });
    };

    return (
      <ClerkButton
        name="SignUpButton"
        defaultText="Sign up"
        attributes={rest}
        onClick={local.onClick}
        action={signUp}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'SignUpButton', renderWhileLoading: true }
);
