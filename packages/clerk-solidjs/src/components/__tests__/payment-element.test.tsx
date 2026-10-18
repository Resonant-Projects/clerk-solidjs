import type { UserResource } from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/query-core';
import { createSignal, Show } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';
import {
  PaymentElement,
  PaymentElementProvider,
  usePaymentElement
} from '../../experimental';
import { __setClerkQueryClientForTest } from '../../query/clerk-query-client';

/** Stripe.js's shape, as far as PaymentElement uses it. */
const fakeStripe = () => {
  const handlers: Record<string, () => void> = {};
  const element = {
    mount: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler;
    }),
    update: vi.fn(),
    destroy: vi.fn()
  };
  const elements = { create: vi.fn(() => element), update: vi.fn() };
  const stripe = {
    elements: vi.fn(() => elements),
    confirmSetup: vi.fn(async () => ({
      setupIntent: { payment_method: 'pm_123' }
    }))
  };
  return { stripe, elements, element, ready: () => handlers.ready?.() };
};

const initialized = (secret = 'seti_secret') => ({
  externalClientSecret: secret,
  externalGatewayId: 'acct_1',
  paymentMethodOrder: ['card']
});

const signedInAs = (user: UserResource) => ({
  user,
  session: {
    id: `sess_${user.id}`,
    status: 'active',
    user,
    lastActiveToken: { jwt: { claims: {} } }
  } as any
});

const setup = () => {
  const fake = fakeStripe();
  const loadStripe = vi.fn(async () => fake.stripe);
  const initializePaymentMethod = vi.fn(async () => initialized());
  const user = {
    id: 'user_1',
    organizationMemberships: [],
    initializePaymentMethod
  } as unknown as UserResource;
  const { clerkJS, emit } = createFakeClerkJS(signedInAs(user));
  Object.assign(clerkJS, {
    __internal_loadStripeJs: vi.fn(async () => loadStripe),
    __internal_getOption: () => undefined,
    __internal_environment: {
      commerceSettings: {
        billing: {
          stripePublishableKey: 'pk_test_stripe',
          user: { enabled: true },
          organization: { enabled: true }
        }
      },
      displayConfig: {}
    }
  });
  return { clerkJS, emit, fake, loadStripe, initializePaymentMethod };
};

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  __setClerkQueryClientForTest(queryClient);
});

afterEach(() => {
  cleanup();
  __setClerkQueryClientForTest(undefined);
});

describe('PaymentElement', () => {
  it('mounts Stripe once it has loaded, then submits and resets', async () => {
    const { clerkJS, fake, loadStripe, initializePaymentMethod } = setup();
    let payment!: ReturnType<typeof usePaymentElement>;
    const Form = () => {
      payment = usePaymentElement();
      return <PaymentElement fallback={<p>Loading payment form...</p>} />;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <PaymentElementProvider>
          <Form />
        </PaymentElementProvider>
      </ClerkProvider>
    ));

    expect(screen.getByText('Loading payment form...')).toBeTruthy();
    await vi.waitFor(() => expect(fake.element.mount).toHaveBeenCalled());
    expect(loadStripe).toHaveBeenCalledWith('pk_test_stripe', {
      stripeAccount: 'acct_1'
    });
    expect(fake.stripe.elements).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'seti_secret', loader: 'never' })
    );
    expect(fake.elements.create).toHaveBeenCalledWith(
      'payment',
      expect.objectContaining({ paymentMethodOrder: ['card'] })
    );
    expect(payment.isProviderReady).toBe(true);
    expect(payment.isFormReady).toBe(false);

    fake.ready();
    await vi.waitFor(() =>
      expect(screen.queryByText('Loading payment form...')).toBeNull()
    );
    expect(payment.isFormReady).toBe(true);

    await expect(payment.submit()).resolves.toEqual({
      data: { gateway: 'stripe', paymentToken: 'pm_123' },
      error: null
    });
    await payment.reset();
    expect(initializePaymentMethod).toHaveBeenCalledTimes(2);
  });

  it('reports a Stripe error from submit', async () => {
    const { clerkJS, fake } = setup();
    fake.stripe.confirmSetup.mockResolvedValueOnce({
      error: { code: 'card_declined', message: 'Declined', type: 'card_error' }
    } as any);
    let payment!: ReturnType<typeof usePaymentElement>;
    const Form = () => {
      payment = usePaymentElement();
      return <PaymentElement />;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <PaymentElementProvider>
          <Form />
        </PaymentElementProvider>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(fake.element.mount).toHaveBeenCalled());

    await expect(payment.submit()).resolves.toEqual({
      data: null,
      error: {
        gateway: 'stripe',
        error: {
          code: 'card_declined',
          message: 'Declined',
          type: 'card_error'
        }
      }
    });
  });

  it('updates the form in place when its options change, keeping what was typed', async () => {
    const { clerkJS, fake } = setup();
    const [description, setDescription] = createSignal('Monthly');
    const [appearance, setAppearance] = createSignal({ colorPrimary: 'red' });
    const checkout = {
      plan: { name: 'Pro' },
      planPeriod: 'month',
      totals: { grandTotal: { amount: 1000 } }
    } as any;
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <PaymentElementProvider
          checkout={checkout}
          paymentDescription={description()}
          stripeAppearance={appearance() as any}
        >
          <PaymentElement />
        </PaymentElementProvider>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(fake.element.mount).toHaveBeenCalled());

    setDescription('Billed monthly');
    expect(fake.element.update).toHaveBeenCalledWith({
      applePay: expect.objectContaining({
        recurringPaymentRequest: expect.objectContaining({
          paymentDescription: 'Billed monthly'
        })
      })
    });
    setAppearance({ colorPrimary: 'blue' });
    expect(fake.elements.update).toHaveBeenCalledWith({
      appearance: { variables: { colorPrimary: 'blue' } }
    });

    expect(fake.stripe.elements).toHaveBeenCalledTimes(1);
    expect(fake.elements.create).toHaveBeenCalledTimes(1);
    expect(fake.element.destroy).not.toHaveBeenCalled();
  });

  it('is not ready once the form unmounts, nor again until Stripe says so', async () => {
    const { clerkJS, fake } = setup();
    const [shown, setShown] = createSignal(true);
    let payment!: ReturnType<typeof usePaymentElement>;
    const Form = () => {
      payment = usePaymentElement();
      return (
        <Show when={shown()}>
          <PaymentElement fallback={<p>Loading payment form...</p>} />
        </Show>
      );
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <PaymentElementProvider>
          <Form />
        </PaymentElementProvider>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(fake.element.mount).toHaveBeenCalled());
    fake.ready();
    await vi.waitFor(() => expect(payment.isFormReady).toBe(true));

    setShown(false);
    expect(fake.element.destroy).toHaveBeenCalledOnce();
    expect(payment.isFormReady).toBe(false);

    setShown(true);
    expect(fake.elements.create).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Loading payment form...')).toBeTruthy();
    expect(payment.isFormReady).toBe(false);
  });

  it("keeps a reset's payment method with the user it was asked for", async () => {
    const { clerkJS, emit, fake, initializePaymentMethod } = setup();
    let payment!: ReturnType<typeof usePaymentElement>;
    const Form = () => {
      payment = usePaymentElement();
      return <PaymentElement />;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <PaymentElementProvider>
          <Form />
        </PaymentElementProvider>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(fake.element.mount).toHaveBeenCalled());

    let finishReset!: (value: unknown) => void;
    initializePaymentMethod.mockImplementationOnce(
      () => new Promise((resolve) => (finishReset = resolve)) as any
    );
    const reset = payment.reset();
    await vi.waitFor(() =>
      expect(initializePaymentMethod).toHaveBeenCalledTimes(2)
    );

    const nextUser = {
      id: 'user_2',
      organizationMemberships: [],
      initializePaymentMethod: vi.fn(async () => initialized('seti_user_2'))
    } as unknown as UserResource;
    emit(signedInAs(nextUser));
    const keyFor = (resourceId: string) => [
      'billing-payment-method-initialize',
      true,
      { resourceId },
      {}
    ];
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(keyFor('user_2'))).toEqual(
        initialized('seti_user_2')
      )
    );

    finishReset(initialized('seti_user_1_reset'));
    await reset;
    expect(queryClient.getQueryData(keyFor('user_2'))).toEqual(
      initialized('seti_user_2')
    );
    expect(queryClient.getQueryData(keyFor('user_1'))).toEqual(
      initialized('seti_user_1_reset')
    );
  });
});
