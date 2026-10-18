import { splitProps } from 'solid-js';
import type { SignInWithMetamaskButtonProps, WithClerkProp } from '../types';
import { ClerkButton } from '../utils';
import { withClerk } from './with-clerk';

/**
 * Signs in with MetaMask. Renders the default button, or your own element
 * passed as its only child.
 */
export const SignInWithMetamaskButton = withClerk(
  (props: WithClerkProp<SignInWithMetamaskButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      ['clerk', 'redirectUrl', 'mode']
    );

    const authenticate = () =>
      clerkProps.clerk().authenticateWithMetamask({
        redirectUrl: clerkProps.redirectUrl || undefined
      });

    return (
      <ClerkButton
        name="SignInWithMetamaskButton"
        defaultText="Sign in with Metamask"
        attributes={rest}
        onClick={local.onClick}
        action={authenticate}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'SignInWithMetamask', renderWhileLoading: true }
);
