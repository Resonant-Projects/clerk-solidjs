import type { __experimental_CheckoutButtonProps } from '@clerk/shared/types';
import { splitProps } from 'solid-js';
import type { ButtonAttributes, WithClerkProp } from '../../types';
import { ClerkButton } from '../../utils';
import { withClerk } from '../with-clerk';
import { useBillingGuards } from './use-billing-guards';

export type CheckoutButtonProps = ButtonAttributes &
  __experimental_CheckoutButtonProps;

/**
 * Opens Clerk's checkout drawer for a plan. Render it for a signed-in user,
 * and with `for="organization"` only with an active organization.
 */
export const CheckoutButton = withClerk(
  (props: WithClerkProp<CheckoutButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      [
        'clerk',
        'planId',
        'planPeriod',
        'seatsQuantity',
        'priceId',
        'for',
        'onSubscriptionComplete',
        'newSubscriptionRedirectUrl',
        'checkoutProps'
      ]
    );
    const guarded = useBillingGuards('CheckoutButton', () => clerkProps.for);

    const open = () =>
      clerkProps.clerk().__internal_openCheckout({
        planId: clerkProps.planId,
        planPeriod: clerkProps.planPeriod,
        seatsQuantity: clerkProps.seatsQuantity,
        priceId: clerkProps.priceId,
        for: clerkProps.for,
        onSubscriptionComplete: clerkProps.onSubscriptionComplete,
        newSubscriptionRedirectUrl: clerkProps.newSubscriptionRedirectUrl,
        ...clerkProps.checkoutProps
      });

    return (
      <>
        {guarded() && (
          <ClerkButton
            name="CheckoutButton"
            defaultText="Checkout"
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
  { component: 'CheckoutButton', renderWhileLoading: true }
);
