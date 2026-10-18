import type {
  BillingPaymentMethodResource,
  BillingPaymentResource,
  BillingPlanResource,
  BillingStatementResource,
  GetPaymentAttemptsParams,
  GetPaymentMethodsParams,
  GetPlansParams,
  GetStatementsParams
} from '@clerk/shared/types';
import { STABLE_KEYS } from '../../query/keys';
import { createBillingPaginatedHook } from './create-billing-paginated-hook';

export type { BillingHookParams } from './create-billing-paginated-hook';

/** The instance's plans for users or organizations. Fetched signed out too. */
export const usePlans = createBillingPaginatedHook<
  BillingPlanResource,
  GetPlansParams
>({
  hookName: 'usePlans',
  resourceType: STABLE_KEYS.PLANS_KEY,
  fetcher: ({ clerk, loaded, payer }) =>
    loaded
      ? (params) => clerk.billing!.getPlans({ ...params, for: payer })
      : undefined,
  options: { unauthenticated: true }
});

/** The payer's billing statements. */
export const useStatements = createBillingPaginatedHook<
  BillingStatementResource,
  GetStatementsParams
>({
  hookName: 'useStatements',
  resourceType: STABLE_KEYS.STATEMENTS_KEY,
  fetcher: ({ clerk, loaded }) =>
    loaded ? clerk.billing?.getStatements : undefined
});

/** The payer's payment attempts. */
export const usePaymentAttempts = createBillingPaginatedHook<
  BillingPaymentResource,
  GetPaymentAttemptsParams
>({
  hookName: 'usePaymentAttempts',
  resourceType: STABLE_KEYS.PAYMENT_ATTEMPTS_KEY,
  fetcher: ({ clerk, loaded }) =>
    loaded ? clerk.billing?.getPaymentAttempts : undefined
});

/** The user's or active organization's saved payment methods. */
export const usePaymentMethods = createBillingPaginatedHook<
  BillingPaymentMethodResource,
  GetPaymentMethodsParams
>({
  hookName: 'usePaymentMethods',
  resourceType: STABLE_KEYS.PAYMENT_METHODS_KEY,
  fetcher: ({ payer, user, organization }) =>
    payer === 'organization'
      ? organization?.getPaymentMethods
      : user?.getPaymentMethods
});

export { useSubscription } from './use-subscription';
export type {
  UseSubscriptionParams,
  UseSubscriptionReturn
} from './use-subscription';
