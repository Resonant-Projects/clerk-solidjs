import type { __experimental_SubscriptionDetailsButtonProps } from '@clerk/shared/types';
import { splitProps } from 'solid-js';
import type { ButtonAttributes, WithClerkProp } from '../../types';
import { ClerkButton } from '../../utils';
import { withClerk } from '../with-clerk';
import { useBillingGuards } from './use-billing-guards';

export type SubscriptionDetailsButtonProps = ButtonAttributes &
  __experimental_SubscriptionDetailsButtonProps;

/**
 * Opens Clerk's drawer with the user's or organization's subscription.
 * Render it for a signed-in user, and with `for="organization"` only with an
 * active organization.
 */
export const SubscriptionDetailsButton = withClerk(
  (props: WithClerkProp<SubscriptionDetailsButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      ['clerk', 'for', 'onSubscriptionCancel', 'subscriptionDetailsProps']
    );
    const guarded = useBillingGuards(
      'SubscriptionDetailsButton',
      () => clerkProps.for
    );

    const open = () =>
      clerkProps.clerk().__internal_openSubscriptionDetails({
        for: clerkProps.for,
        onSubscriptionCancel: clerkProps.onSubscriptionCancel,
        ...clerkProps.subscriptionDetailsProps
      });

    return (
      <>
        {guarded() && (
          <ClerkButton
            name="SubscriptionDetailsButton"
            defaultText="Subscription details"
            attributes={rest}
            onClick={local.onClick}
            action={open}
          >
            {local.children}
          </ClerkButton>
        )}
      </>
    );
  },
  { component: 'SubscriptionDetailsButton', renderWhileLoading: true }
);
