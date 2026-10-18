import type { UserResource } from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { QueryClient } from '@tanstack/query-core';
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
    destroy: vi.fn()
  };
  const elements = { create: vi.fn(() => element) };
  const stripe = {
    elements: vi.fn(() => elements),
    confirmSetup: vi.fn(async () => ({
      setupIntent: { payment_method: 'pm_123' }
    }))
  };
  return { stripe, elements, element, ready: () => handlers.ready?.() };
};

const setup = () => {
  const fake = fakeStripe();
  const loadStripe = vi.fn(async () => fake.stripe);
  const initializePaymentMethod = vi.fn(async () => ({
    externalClientSecret: 'seti_secret',
    externalGatewayId: 'acct_1',
    paymentMethodOrder: ['card']
  }));
  const user = {
    id: 'user_1',
    organizationMemberships: [],
    initializePaymentMethod
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
  return { clerkJS, fake, loadStripe, initializePaymentMethod };
};

beforeEach(() => {
  __setClerkQueryClientForTest(
    new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
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
});
