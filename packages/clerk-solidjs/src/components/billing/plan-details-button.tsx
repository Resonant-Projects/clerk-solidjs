import type {
  __experimental_PlanDetailsButtonProps,
  __internal_PlanDetailsProps
} from '@clerk/shared/types';
import { splitProps } from 'solid-js';
import type { ButtonAttributes, WithClerkProp } from '../../types';
import { ClerkButton } from '../../utils';
import { withClerk } from '../with-clerk';

export type PlanDetailsButtonProps = ButtonAttributes &
  __experimental_PlanDetailsButtonProps;

/** Opens Clerk's drawer with a plan's details, signed in or not. */
export const PlanDetailsButton = withClerk(
  (props: WithClerkProp<PlanDetailsButtonProps>) => {
    const [local, clerkProps, rest] = splitProps(
      props,
      ['children', 'onClick'],
      ['clerk', 'plan', 'planId', 'initialPlanPeriod', 'planDetailsProps']
    );

    const open = () =>
      clerkProps.clerk().__internal_openPlanDetails({
        plan: clerkProps.plan,
        planId: clerkProps.planId,
        initialPlanPeriod: clerkProps.initialPlanPeriod,
        ...clerkProps.planDetailsProps
      } as __internal_PlanDetailsProps);

    return (
      <ClerkButton
        name="PlanDetailsButton"
        defaultText="Plan details"
        attributes={rest}
        onClick={local.onClick}
        action={open}
      >
        {local.children}
      </ClerkButton>
    );
  },
  { component: 'PlanDetailsButton', renderWhileLoading: true }
);
