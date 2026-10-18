import type {
  BillingCheckoutResource,
  BillingInitializedPaymentMethodResource,
  CheckoutFlowResource,
  ForPayerType
} from '@clerk/shared/types';
import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  Show,
  untrack,
  useContext
} from 'solid-js';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useOrganizationContext } from '../../contexts/organization';
import { useUserContext } from '../../contexts/user';
import { useBillingIsEnabled } from '../../hooks/billing/use-billing-is-enabled';
import { getClerkQueryClient } from '../../query/clerk-query-client';
import { createClerkQuery } from '../../query/create-clerk-query';

// The parts of Stripe.js this file uses. Clerk loads Stripe.js itself, so
// the package does not depend on @stripe/stripe-js.
type StripePaymentElement = {
  mount: (node: HTMLElement) => void;
  on: (event: 'ready', handler: () => void) => void;
  update: (options: Record<string, unknown>) => void;
  destroy: () => void;
};
type StripeElements = {
  create: (
    type: 'payment',
    options: Record<string, unknown>
  ) => StripePaymentElement;
  update: (options: Record<string, unknown>) => void;
};
type Stripe = {
  elements: (options: Record<string, unknown>) => StripeElements;
  confirmSetup: (options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
    redirect: 'if_required';
  }) => Promise<{
    setupIntent?: { payment_method?: unknown };
    error?: { code?: string; message?: string; type: string };
  }>;
};
type LoadStripe = (
  publishableKey: string,
  options: { stripeAccount: string }
) => Promise<Stripe | null>;

type StripeAppearance = {
  colorPrimary: string;
  colorBackground: string;
  colorText: string;
  colorTextSecondary: string;
  colorSuccess: string;
  colorDanger: string;
  colorWarning: string;
  fontWeightNormal: string;
  fontWeightMedium: string;
  fontWeightBold: string;
  fontSizeXl: string;
  fontSizeLg: string;
  fontSizeSm: string;
  fontSizeXs: string;
  borderRadius: string;
  spacingUnit: string;
};

export type PaymentElementProviderProps = {
  /** A checkout from `useCheckout()`, for Apple Pay's recurring payment details. */
  checkout?: CheckoutFlowResource | BillingCheckoutResource;
  stripeAppearance?: StripeAppearance;
  /** `'user'` (the default) or `'organization'`. */
  for?: ForPayerType;
  paymentDescription?: string;
  children?: JSX.Element;
};

type PaymentElementContextValue = {
  props: PaymentElementProviderProps;
  stripe: Accessor<Stripe | null | undefined>;
  elements: Accessor<StripeElements | undefined>;
  initializedPaymentMethod: Accessor<
    BillingInitializedPaymentMethodResource | undefined
  >;
  initializePaymentMethod: () => Promise<
    BillingInitializedPaymentMethodResource | undefined
  >;
  isReady: Accessor<boolean>;
  setReady: (ready: boolean) => void;
};

const PaymentElementContext = createContext<PaymentElementContextValue>();

/**
 * The options in `next` that differ from `previous`, or `undefined` if none
 * do, as Stripe's React binding sends them to `update()`. They are plain
 * data, so JSON compares them.
 */
const changedOptions = (
  next: Record<string, unknown>,
  previous: Record<string, unknown>
) => {
  let changed: Record<string, unknown> | undefined;
  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) {
      changed = { ...changed, [key]: next[key] };
    }
  }
  return changed;
};

const usePaymentElementContext = (name: string) => {
  const context = useContext(PaymentElementContext);
  if (!context) {
    throw new Error(
      `Clerk: ${name} can only be used inside <PaymentElementProvider>.`
    );
  }
  return context;
};

/**
 * Loads Stripe for the payer's payment method and provides it to
 * `<PaymentElement>` and `usePaymentElement()`, as `@clerk/shared`'s
 * provider does. Stripe.js comes from Clerk; nothing loads until billing is
 * on and a user is signed in.
 */
export const PaymentElementProvider = (
  props: PaymentElementProviderProps
): JSX.Element => {
  const clerk = useIsomorphicClerkContext();
  const user = useUserContext();
  const organization = useOrganizationContext();
  const billingEnabled = useBillingIsEnabled(() => ({ for: props.for }));
  const billingEnabledSignedIn = useBillingIsEnabled(() => ({
    authenticated: true
  }));

  const resource = () =>
    props.for === 'organization' ? organization() : user();

  const stripeLibs = createClerkQuery(() => ({
    queryKey: ['clerk-stripe-sdk'],
    queryFn: async () => ({
      loadStripe: (await untrack(clerk).__internal_loadStripeJs()) as LoadStripe
    }),
    // Not for a signed-out visitor or with billing off, who cannot pay:
    // Stripe.js is a third-party script. @clerk/shared loads it regardless.
    enabled: billingEnabledSignedIn(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  }));

  const initializeKey = () =>
    [
      'billing-payment-method-initialize',
      true,
      { resourceId: resource()?.id },
      {}
    ] as const;

  const initialized = createClerkQuery(() => ({
    queryKey: initializeKey(),
    queryFn: async () =>
      resource()?.initializePaymentMethod({ gateway: 'stripe' }),
    enabled: !!resource()?.id && billingEnabled(),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  }));

  const initializedPaymentMethod = () =>
    (initialized().data ?? undefined) as
      BillingInitializedPaymentMethodResource | undefined;

  const stripePublishableKey = () =>
    clerk().__internal_environment?.commerceSettings.billing
      .stripePublishableKey ?? undefined;

  const stripeQuery = createClerkQuery(() => {
    const libs = stripeLibs().data as { loadStripe: LoadStripe } | undefined;
    const externalGatewayId = initializedPaymentMethod()?.externalGatewayId;
    const publishableKey = stripePublishableKey();
    return {
      queryKey: [
        'stripe-sdk',
        { externalGatewayId, stripePublishableKey: publishableKey }
      ],
      queryFn: () =>
        libs && externalGatewayId && publishableKey
          ? libs.loadStripe(publishableKey, {
              stripeAccount: externalGatewayId
            })
          : null,
      enabled:
        !!(libs && externalGatewayId && publishableKey) &&
        billingEnabledSignedIn(),
      staleTime: 60_000,
      refetchOnWindowFocus: false
    };
  });

  const loadedStripe = () => stripeQuery().data as Stripe | null | undefined;
  // Memos, so a refetch that changes only the query's state recreates
  // nothing: createClerkQuery publishes every result.
  const hasStripe = createMemo(() => !!loadedStripe());
  const clientSecret = createMemo(
    () => initializedPaymentMethod()?.externalClientSecret
  );

  const locale = () => {
    try {
      const localization = untrack(clerk).__internal_getOption(
        'localization'
      ) as { locale?: string } | undefined;
      return (localization?.locale || 'en').split('-')[0];
    } catch {
      return 'en';
    }
  };

  // New Elements for each client secret, as upstream keys <Elements> by it,
  // from the Stripe instance loaded then: like Stripe's React binding, a
  // later instance does not replace it. Other options update the Elements in
  // place. New Elements would discard what the user has typed.
  const stripeElements = createMemo(() => {
    const secret = clientSecret();
    if (!hasStripe() || !secret) return undefined;
    const instance = untrack(loadedStripe)!;
    return {
      stripe: instance,
      elements: instance.elements({
        loader: 'never',
        clientSecret: secret,
        appearance: { variables: untrack(() => props.stripeAppearance) },
        locale: untrack(locale)
      })
    };
  });
  const stripe = () => stripeElements()?.stripe;
  const elements = () => stripeElements()?.elements;
  createEffect(
    on(
      () => props.stripeAppearance,
      (variables) => untrack(elements)?.update({ appearance: { variables } }),
      { defer: true }
    )
  );

  const [isReady, setReady] = createSignal(false);
  createEffect(() => {
    // A new form is not ready until Stripe says so.
    elements();
    setReady(false);
  });

  const initializePaymentMethod = async () => {
    const current = untrack(resource);
    if (!current) return undefined;
    // The key of the payer it was asked for, even if the payer changes first.
    const key = untrack(initializeKey);
    const result = await current.initializePaymentMethod({ gateway: 'stripe' });
    getClerkQueryClient()?.setQueryData(key, result);
    return result;
  };

  return (
    <PaymentElementContext.Provider
      value={{
        props,
        stripe,
        elements,
        initializedPaymentMethod,
        initializePaymentMethod,
        isReady,
        setReady
      }}
    >
      {props.children}
    </PaymentElementContext.Provider>
  );
};

/**
 * Stripe's payment form for the payer, inside `<PaymentElementProvider>`.
 * `fallback` shows until Stripe has rendered it.
 */
export const PaymentElement = (props: {
  fallback?: JSX.Element;
}): JSX.Element => {
  const context = usePaymentElementContext('PaymentElement');
  const clerk = useIsomorphicClerkContext();
  let node: HTMLDivElement | undefined;

  const applePay = () => {
    const checkout = context.props.checkout as
      BillingCheckoutResource | undefined;
    if (!checkout?.totals || !checkout.plan) return undefined;
    const display = untrack(clerk).__internal_environment?.displayConfig;
    return {
      recurringPaymentRequest: {
        paymentDescription: context.props.paymentDescription || '',
        managementURL:
          context.props.for === 'organization'
            ? display?.organizationProfileUrl || ''
            : display?.userProfileUrl || '',
        regularBilling: {
          amount:
            checkout.totals.totalDueNow?.amount ||
            checkout.totals.grandTotal.amount,
          label: checkout.plan.name,
          recurringPaymentIntervalUnit:
            checkout.planPeriod === 'annual' ? 'year' : 'month'
        }
      }
    };
  };

  const options = (): Record<string, unknown> => ({
    layout: { type: 'tabs', defaultCollapsed: false },
    paymentMethodOrder: context.initializedPaymentMethod()?.paymentMethodOrder,
    applePay: applePay()
  });

  // One payment element per Elements. Later option changes go through
  // update(), as in Stripe's React binding: destroying the element would
  // discard what the user has typed.
  createEffect(() => {
    const elements = context.elements();
    if (!elements || !node) return;
    let current = untrack(options);
    const element = elements.create('payment', current);
    element.on('ready', () => context.setReady(true));
    element.mount(node);
    createEffect(
      on(
        options,
        (next) => {
          const updates = changedOptions(next, current);
          current = next;
          if (updates) element.update(updates);
        },
        { defer: true }
      )
    );
    onCleanup(() => {
      element.destroy();
      // A destroyed form is not ready, nor its replacement until Stripe says.
      context.setReady(false);
    });
  });

  return (
    <>
      <Show when={!context.isReady()}>{props.fallback}</Show>
      <div
        ref={(el) => (node = el)}
        style={{ display: context.isReady() ? undefined : 'none' }}
      />
    </>
  );
};

const librariesMissing = () => {
  throw new Error(
    'Clerk: Unable to submit, Stripe libraries are not yet loaded. Be sure to check `isFormReady` before calling `submit`.'
  );
};

export type PaymentElementError = {
  gateway: 'stripe';
  error: { code?: string; message?: string; type: string };
};

export type UsePaymentElementReturn = {
  submit: () => Promise<
    | { data: { gateway: 'stripe'; paymentToken: string }; error: null }
    | { data: null; error: PaymentElementError }
  >;
  reset: () => Promise<void>;
  /** The form has rendered and can be submitted. */
  readonly isFormReady: boolean;
  readonly isProviderReady: boolean;
  readonly provider: { name: 'stripe' } | undefined;
};

/**
 * Submits or resets the `<PaymentElement>` form, as `@clerk/shared`'s
 * `usePaymentElement` does. Read `isFormReady` before calling `submit`. The
 * state fields are getters, current wherever they are read.
 */
export const usePaymentElement = (): UsePaymentElementReturn => {
  const context = usePaymentElementContext('usePaymentElement');
  const isProviderReady = () =>
    !!(
      context.stripe() &&
      context.initializedPaymentMethod()?.externalClientSecret
    );

  const submit: UsePaymentElementReturn['submit'] = async () => {
    const stripe = context.stripe();
    const elements = context.elements();
    if (!stripe || !elements) return librariesMissing();
    const { setupIntent, error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    });
    if (error) {
      return {
        data: null,
        error: {
          gateway: 'stripe',
          error: { code: error.code, message: error.message, type: error.type }
        }
      };
    }
    return {
      data: {
        gateway: 'stripe',
        paymentToken: setupIntent?.payment_method as string
      },
      error: null
    };
  };

  const reset = async () => {
    if (!context.stripe() || !context.elements()) return librariesMissing();
    await context.initializePaymentMethod();
  };

  return {
    submit,
    reset,
    get isFormReady() {
      return isProviderReady() && context.isReady();
    },
    get isProviderReady() {
      return isProviderReady();
    },
    get provider() {
      return isProviderReady() ? ({ name: 'stripe' } as const) : undefined;
    }
  };
};
