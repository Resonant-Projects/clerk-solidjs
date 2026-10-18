import type {
  __experimental_CheckoutOptions,
  CheckoutSignalValue
} from '@clerk/shared/types';
import {
  Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext
} from 'solid-js';
import { useClerkLoadState } from '../../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useOrganizationContext } from '../../contexts/organization';
import { useAssertWrappedByClerkProvider } from '../use-assert-wrapped-by-clerk-provider';
import { liveView } from '../use-clerk-signal';
import { useUser } from '../use-user';

export type UseCheckoutOptions = __experimental_CheckoutOptions;

const CheckoutContext = createContext<Accessor<UseCheckoutOptions>>();

/** Supplies `useCheckout()`'s options to the components inside it. */
export const CheckoutProvider = (
  props: UseCheckoutOptions & { children?: JSX.Element }
): JSX.Element => {
  const [local, options] = splitProps(props, ['children']);
  return (
    <CheckoutContext.Provider value={() => ({ ...options })}>
      {local.children}
    </CheckoutContext.Provider>
  );
};

/**
 * A checkout for a plan, from clerk-js's checkout signal, as
 * `@clerk/shared`'s `useCheckout`: `{ checkout, errors, fetchStatus }`.
 * `checkout.start()`, `confirm()` and `finalize()` wait for Clerk to load.
 * Pass the options as an accessor, or set them with `<CheckoutProvider>`.
 * The checkout follows the options, the user and the active organization.
 *
 * Render it for a signed-in user, and with `for: 'organization'` only with
 * an active organization; otherwise it throws to the nearest ErrorBoundary.
 */
export const useCheckout = (
  options?: Accessor<UseCheckoutOptions>
): CheckoutSignalValue => {
  useAssertWrappedByClerkProvider('useCheckout');

  const contextOptions = useContext(CheckoutContext);
  const current = (): UseCheckoutOptions =>
    options?.() ?? contextOptions?.() ?? ({} as UseCheckoutOptions);

  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();
  const { isLoaded, user } = useUser();
  const organization = useOrganizationContext();

  // Kept current, so a later sign-out or org switch reaches an ErrorBoundary.
  createComputed(() => {
    if (!isLoaded()) return;
    if (user() === null) {
      throw new Error(
        'Clerk: Ensure that `useCheckout` is inside a component wrapped with `<Show when="signed-in" />`.'
      );
    }
    if (current().for === 'organization' && organization() === null) {
      throw new Error(
        'Clerk: Ensure your flow checks for an active organization. Retrieve `orgId` from `useAuth()` and confirm it is defined.'
      );
    }
  });

  const instance = untrack(clerk);
  const read = (): CheckoutSignalValue => {
    const {
      for: payer,
      planId,
      planPeriod,
      seatsQuantity,
      priceId
    } = untrack(current);
    return instance.__experimental_checkout({
      planId,
      planPeriod,
      for: payer,
      seatsQuantity,
      priceId
    });
  };

  const [value, setValue] = createSignal(read(), { equals: false });

  // A new checkout when the options, the user or the organization change.
  const key = createMemo(() =>
    JSON.stringify([current(), user()?.id, organization()?.id])
  );

  createEffect(
    on([loaded, key], ([isLoaded]) => {
      setValue(() => read());
      if (!isLoaded) return;
      const dispose = instance.__internal_state.__internal_effect(() => {
        const next = read();
        setValue(() => next);
      });
      onCleanup(dispose);
    })
  );

  // The views read `value()` lazily, in whatever scope reads them.
  return {
    // eslint-disable-next-line solid/reactivity
    checkout: liveView(() => value().checkout),
    // eslint-disable-next-line solid/reactivity
    errors: liveView(() => value().errors),
    get fetchStatus() {
      return value().fetchStatus;
    }
  } as CheckoutSignalValue;
};
