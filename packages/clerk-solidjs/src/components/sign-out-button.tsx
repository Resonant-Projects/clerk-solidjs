import { splitProps } from 'solid-js';
import type { SignOutButtonProps, WithClerkProp } from '../types';
import { ClerkButton } from '../utils';
import { withClerk } from './with-clerk';

/**
 * Signs the user out. Renders the default button, or your own element passed
 * as its only child. Without `redirectUrl`, Clerk goes to `afterSignOutUrl`.
 */
export const SignOutButton = withClerk(
  (props: WithClerkProp<SignOutButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      ['clerk', 'redirectUrl', 'sessionId']
    );

    const signOut = () =>
      clerkProps.clerk().signOut({
        redirectUrl: clerkProps.redirectUrl,
        ...(clerkProps.sessionId !== undefined && {
          sessionId: clerkProps.sessionId
        })
      });

    return (
      <ClerkButton
        name="SignOutButton"
        defaultText="Sign out"
        attributes={rest}
        onClick={local.onClick}
        action={signOut}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'SignOutButton', renderWhileLoading: true }
);
