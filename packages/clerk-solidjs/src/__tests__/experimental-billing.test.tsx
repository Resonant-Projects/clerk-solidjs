import type { UserResource } from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/query-core';
import { ErrorBoundary, type JSX } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider } from '..';
import {
  CheckoutButton,
  CheckoutProvider,
  PlanDetailsButton,
  SubscriptionDetailsButton,
  useCheckout,
  usePaymentMethods,
  usePlans,
  useStatements,
  useSubscription
} from '../experimental';
import { __setClerkQueryClientForTest } from '../query/clerk-query-client';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from './helpers/fake-clerk-js';

const billingEnvironment = (user = true, organization = true) => ({
  __internal_environment: {
    commerceSettings: {
      billing: {
        user: { enabled: user },
        organization: { enabled: organization }
      }
    }
  }
});

const page = <T,>(data: T[]) => ({ data, total_count: data.length });

const signedIn = (members: Record<string, unknown> = {}, userFields = {}) => {
  const user = {
    id: 'user_1',
    organizationMemberships: [],
    getPaymentMethods: vi.fn(async () => page([{ id: 'pm_user' }])),
    ...userFields
  } as unknown as UserResource;
  const { clerkJS } = createFakeClerkJS({
    user,
    session: {
      id: 'sess_1',
      status: 'active',
      user,
      lastActiveToken: { jwt: { claims: {} } }
    } as any
  });
  return Object.assign(clerkJS, billingEnvironment(), members) as any;
};

const signedOut = (members: Record<string, unknown> = {}) => {
  const { clerkJS } = createFakeClerkJS();
  return Object.assign(clerkJS, billingEnvironment(), members) as any;
};

const renderInProvider = (clerkJS: unknown, ui: () => JSX.Element) =>
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      {ui()}
    </ClerkProvider>
  ));

beforeEach(() => {
  __setClerkQueryClientForTest(
    new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
});

afterEach(() => {
  cleanup();
  __setClerkQueryClientForTest(undefined);
});

describe('billing buttons', () => {
  it('open their drawers with their props', async () => {
    const drawers = {
      __internal_openCheckout: vi.fn(),
      __internal_openPlanDetails: vi.fn(),
      __internal_openSubscriptionDetails: vi.fn()
    };
    const clerkJS = signedIn(drawers);
    renderInProvider(clerkJS, () => (
      <>
        <CheckoutButton planId="plan_pro" planPeriod="month" />
        <PlanDetailsButton planId="plan_pro" initialPlanPeriod="annual" />
        <SubscriptionDetailsButton for="user" />
      </>
    ));
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));

    screen.getByRole('button', { name: 'Checkout' }).click();
    screen.getByRole('button', { name: 'Plan details' }).click();
    screen.getByRole('button', { name: 'Subscription details' }).click();

    await vi.waitFor(() =>
      expect(drawers.__internal_openSubscriptionDetails).toHaveBeenCalled()
    );
    expect(drawers.__internal_openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ planId: 'plan_pro', planPeriod: 'month' })
    );
    expect(drawers.__internal_openPlanDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan_pro',
        initialPlanPeriod: 'annual'
      })
    );
    expect(drawers.__internal_openSubscriptionDetails).toHaveBeenCalledWith(
      expect.objectContaining({ for: 'user' })
    );
  });

  it('throw to the ErrorBoundary once the user is known to be signed out', async () => {
    const clerkJS = signedOut();
    renderInProvider(clerkJS, () => (
      <ErrorBoundary fallback={(error) => <p>{error.message}</p>}>
        <CheckoutButton planId="plan_pro" />
      </ErrorBoundary>
    ));

    expect(
      await screen.findByText(/rendered only when the user is signed in/)
    ).toBeTruthy();
  });

  it('require an active organization for for="organization"', async () => {
    const clerkJS = signedIn();
    renderInProvider(clerkJS, () => (
      <ErrorBoundary fallback={(error) => <p>{error.message}</p>}>
        <SubscriptionDetailsButton for="organization" />
      </ErrorBoundary>
    ));

    expect(
      await screen.findByText(/check for an active organization/)
    ).toBeTruthy();
  });
});

describe('billing hooks', () => {
  it('usePlans lists the plans signed out, for the payer', async () => {
    const getPlans = vi.fn(async () => page([{ id: 'plan_pro' }]));
    const clerkJS = signedOut({ billing: { getPlans } });
    let plans!: ReturnType<typeof usePlans>;
    renderInProvider(clerkJS, () => {
      plans = usePlans(() => ({ for: 'organization' }));
      return null;
    });

    await vi.waitFor(() => expect(plans.data()).toEqual([{ id: 'plan_pro' }]));
    expect(getPlans).toHaveBeenCalledWith(
      expect.objectContaining({
        for: 'organization',
        initialPage: 1,
        pageSize: 10
      })
    );
  });

  it('useStatements and usePaymentMethods fetch for a signed-in user', async () => {
    const getStatements = vi.fn(async () => page([{ id: 'st_1' }]));
    const clerkJS = signedIn({ billing: { getStatements } });
    let statements!: ReturnType<typeof useStatements>;
    let methods!: ReturnType<typeof usePaymentMethods>;
    renderInProvider(clerkJS, () => {
      statements = useStatements();
      methods = usePaymentMethods();
      return null;
    });

    await vi.waitFor(() => expect(statements.data()).toEqual([{ id: 'st_1' }]));
    await vi.waitFor(() => expect(methods.data()).toEqual([{ id: 'pm_user' }]));
  });

  it('fetch nothing when billing is off for the payer', async () => {
    const getStatements = vi.fn();
    const clerkJS = signedIn({
      billing: { getStatements },
      ...billingEnvironment(false, false)
    });
    renderInProvider(clerkJS, () => {
      useStatements();
      return null;
    });
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getStatements).not.toHaveBeenCalled();
  });

  it('useSubscription fetches the subscription and revalidates it', async () => {
    let status = 'active';
    const getSubscription = vi.fn(async () => ({ id: 'sub_1', status }));
    const clerkJS = signedIn({ billing: { getSubscription } });
    let subscription!: ReturnType<typeof useSubscription>;
    renderInProvider(clerkJS, () => {
      subscription = useSubscription();
      return null;
    });

    await vi.waitFor(() =>
      expect(subscription.data()).toEqual({ id: 'sub_1', status: 'active' })
    );
    expect(getSubscription).toHaveBeenCalledWith({ orgId: undefined });

    status = 'past_due';
    await subscription.revalidate();
    await vi.waitFor(() =>
      expect(subscription.data()).toEqual({ id: 'sub_1', status: 'past_due' })
    );
  });
});

describe('billing for an organization with none active', () => {
  it("never shows the user's cached subscription or payment methods", async () => {
    const getSubscription = vi.fn(async () => ({ id: 'sub_user' }));
    const clerkJS = signedIn({ billing: { getSubscription } });
    let userSubscription!: ReturnType<typeof useSubscription>;
    let userMethods!: ReturnType<typeof usePaymentMethods>;
    let orgSubscription!: ReturnType<typeof useSubscription>;
    let orgMethods!: ReturnType<typeof usePaymentMethods>;
    renderInProvider(clerkJS, () => {
      userSubscription = useSubscription();
      userMethods = usePaymentMethods();
      orgSubscription = useSubscription(() => ({ for: 'organization' }));
      orgMethods = usePaymentMethods(() => ({ for: 'organization' }));
      return null;
    });
    await vi.waitFor(() =>
      expect(userSubscription.data()).toEqual({ id: 'sub_user' })
    );
    await vi.waitFor(() => expect(userMethods.data()).toHaveLength(1));

    expect(orgSubscription.data()).toBeUndefined();
    expect(orgMethods.data()).toEqual([]);
    expect(getSubscription).toHaveBeenCalledTimes(1);
  });
});

describe('useSubscription across accounts', () => {
  it("does not keep the previous user's subscription for the next one", async () => {
    let finishSecond!: (value: unknown) => void;
    const getSubscription = vi
      .fn()
      .mockResolvedValueOnce({ id: 'sub_user_1' })
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishSecond = resolve))
      );
    const user = {
      id: 'user_1',
      organizationMemberships: []
    } as unknown as UserResource;
    const { clerkJS, emit } = createFakeClerkJS({
      user,
      session: {
        id: 'sess_1',
        status: 'active',
        user,
        lastActiveToken: { jwt: { claims: {} } }
      } as any
    });
    Object.assign(clerkJS, billingEnvironment(), {
      billing: { getSubscription }
    });
    let subscription!: ReturnType<typeof useSubscription>;
    renderInProvider(clerkJS, () => {
      subscription = useSubscription(() => ({ keepPreviousData: true }));
      return null;
    });
    await vi.waitFor(() =>
      expect(subscription.data()).toEqual({ id: 'sub_user_1' })
    );

    const nextUser = {
      id: 'user_2',
      organizationMemberships: []
    } as unknown as UserResource;
    emit({
      user: nextUser,
      session: {
        id: 'sess_2',
        status: 'active',
        user: nextUser,
        lastActiveToken: { jwt: { claims: {} } }
      } as any
    });
    await vi.waitFor(() => expect(getSubscription).toHaveBeenCalledTimes(2));
    expect(subscription.data()).toBeUndefined();

    finishSecond({ id: 'sub_user_2' });
    await vi.waitFor(() =>
      expect(subscription.data()).toEqual({ id: 'sub_user_2' })
    );
  });
});

describe('useCheckout', () => {
  it("follows clerk-js's checkout signal, with options from CheckoutProvider", async () => {
    const signals = createFakeState();
    let checkoutValue = {
      errors: { raw: null, global: null },
      fetchStatus: 'idle' as const,
      checkout: {
        status: 'needs_initialization',
        start: vi.fn(async () => ({ error: null }))
      }
    };
    const __experimental_checkout = vi.fn(() => checkoutValue);
    const clerkJS = signedIn({
      __internal_state: signals.state,
      __experimental_checkout
    });

    let checkout!: ReturnType<typeof useCheckout>;
    const Probe = () => {
      checkout = useCheckout();
      return <p data-testid="status">{checkout.checkout.status}</p>;
    };
    renderInProvider(clerkJS, () => (
      <CheckoutProvider planId="plan_pro" planPeriod="month">
        <Probe />
      </CheckoutProvider>
    ));

    await vi.waitFor(() =>
      expect(__experimental_checkout).toHaveBeenCalledWith(
        expect.objectContaining({ planId: 'plan_pro', planPeriod: 'month' })
      )
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe(
        'needs_initialization'
      )
    );

    checkoutValue = {
      ...checkoutValue,
      checkout: { ...checkoutValue.checkout, status: 'needs_confirmation' }
    };
    signals.set('signIn', {});
    expect(screen.getByTestId('status').textContent).toBe('needs_confirmation');
  });
});
