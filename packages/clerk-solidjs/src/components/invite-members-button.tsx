import { splitProps } from 'solid-js';
import { usePortalRoot } from '../contexts/portal';
import type { InviteMembersButtonProps, WithClerkProp } from '../types';
import { ClerkButton } from '../utils';
import { withClerk } from './with-clerk';

/**
 * Opens Clerk's invite-members modal for the active organization. Renders
 * the default button, or your own element passed as its only child. It
 * renders on the server and before Clerk loads; a click before load runs
 * once it has.
 */
export const InviteMembersButton = withClerk(
  (props: WithClerkProp<InviteMembersButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      ['clerk', 'appearance']
    );
    // Modals open in an UNSAFE_PortalProvider's container, if any.
    const getContainer = usePortalRoot();

    const open = () =>
      clerkProps.clerk().openInviteMembers({
        appearance: clerkProps.appearance,
        getContainer
      });

    return (
      <ClerkButton
        name="InviteMembersButton"
        defaultText="Invite members"
        attributes={rest}
        onClick={local.onClick}
        action={open}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'InviteMembersButton', renderWhileLoading: true }
);
