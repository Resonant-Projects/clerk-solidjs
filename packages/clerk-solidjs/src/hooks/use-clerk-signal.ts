import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  SignInSignalValue,
  SignUpSignalValue,
  WaitlistSignalValue
} from '@clerk/shared/types';
import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { StateProxy } from '../state-proxy';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

/**
 * A stable object that reads `current()` on every access. It stays current,
 * and tracks in a reactive scope, after a component keeps it, as in
 * `const { signIn } = useSignIn()`. Methods are bound to the current object,
 * since clerk-js resources keep their state in private fields.
 *
 * @internal
 */
export const liveView = <T extends object>(current: () => T): T =>
  new Proxy({} as T, {
    get(_, key) {
      const target = current();
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set: (_, key, value) => Reflect.set(current(), key, value),
    has: (_, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor(_, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
      // The proxy's own target is empty, so what it reports must be configurable.
      return descriptor && { ...descriptor, configurable: true };
    }
  });

const signalKeys = {
  signIn: 'signInSignal',
  signUp: 'signUpSignal',
  waitlist: 'waitlistSignal'
} as const;

const hookNames = {
  signIn: 'useSignIn',
  signUp: 'useSignUp',
  waitlist: 'useWaitlist'
} as const;

type SignalValues = {
  signIn: SignInSignalValue;
  signUp: SignUpSignalValue;
  waitlist: WaitlistSignalValue;
};

/**
 * Bridges one of clerk-js's signals into Solid. Before clerk-js loads, and on
 * the server, it reads `__internal_state`'s stand-in, whose properties are
 * defaults and whose methods wait for clerk-js. Once loaded, it follows
 * clerk-js's signal through `__internal_effect` until the owner is disposed.
 */
const useClerkSignal = <K extends keyof SignalValues>(
  name: K
): SignalValues[K] => {
  useAssertWrappedByClerkProvider(hookNames[name]);

  const clerk = useIsomorphicClerkContext();
  const { loaded } = useClerkLoadState();

  recordTelemetryOnce(clerk, () =>
    eventMethodCalled(hookNames[name], { apiVersion: '2025-11' })
  );

  // `clerk()` also tracks Clerk's status; the bridge follows `loaded` only.
  const instance = untrack(clerk);
  const read = () =>
    instance.__internal_state[signalKeys[name]]() as SignalValues[K];

  const [value, setValue] = createSignal(read(), { equals: false });

  createEffect(
    on(loaded, (isLoaded) => {
      // Swap the stand-in for clerk-js's value once it has loaded.
      setValue(() => read());
      if (!isLoaded) return;
      const state = instance.__internal_state;
      const dispose = state.__internal_effect(() => {
        const next = state[signalKeys[name]]() as SignalValues[K];
        setValue(() => next);
      });
      onCleanup(dispose);
    })
  );

  // clerk-js has no sign-in or sign-up until the client creates one. Like
  // @clerk/react's stand-in, use the client's then.
  let standIn: StateProxy | undefined;
  const resource = () => {
    const current = value() as Record<K, object | null>;
    return (
      current[name] ??
      (
        (standIn ??= new StateProxy(instance))[signalKeys[name]]() as Record<
          K,
          object
        >
      )[name]
    );
  };

  // The views read `value()` lazily, in whatever scope reads them.
  return {
    // eslint-disable-next-line solid/reactivity
    [name]: liveView(resource),
    // eslint-disable-next-line solid/reactivity
    errors: liveView(() => value().errors),
    get fetchStatus() {
      return value().fetchStatus;
    }
  } as unknown as SignalValues[K];
};

/**
 * The Core 3 sign-in hook: `{ signIn, errors, fetchStatus }`, from clerk-js's
 * signals. `signIn` and `errors` stay current and reactive when destructured.
 * Read `fetchStatus` from the result, as a string cannot.
 *
 * Its methods wait for Clerk to load, so a form can call them right away.
 * On the server it returns defaults. The Core 2 hook, with `isLoaded` and
 * `setActive`, is in `@resonant-projects/clerk-solidjs/legacy`.
 *
 * @example
 * const state = useSignIn();
 * const { signIn, errors } = state;
 *
 * const submit = async () => {
 *   await signIn.password({ identifier: email(), password: password() });
 *   if (signIn.status === 'complete') {
 *     await signIn.finalize({ navigate: () => navigate('/') });
 *   }
 * };
 *
 * <Show when={errors.fields.identifier}>{(e) => <p>{e().message}</p>}</Show>
 * <button disabled={state.fetchStatus === 'fetching'} onClick={submit}>
 *   Sign in
 * </button>
 */
export const useSignIn = (): SignInSignalValue => useClerkSignal('signIn');

/**
 * The Core 3 sign-up hook: `{ signUp, errors, fetchStatus }`, from clerk-js's
 * signals. `signUp` and `errors` stay current and reactive when destructured.
 * Read `fetchStatus` from the result, as a string cannot.
 *
 * The Core 2 hook is in `@resonant-projects/clerk-solidjs/legacy`.
 */
export const useSignUp = (): SignUpSignalValue => useClerkSignal('signUp');

/**
 * The waitlist hook: `{ waitlist, errors, fetchStatus }`, from clerk-js's
 * signals. Join with `waitlist.join({ emailAddress })`.
 */
export const useWaitlist = (): WaitlistSignalValue =>
  useClerkSignal('waitlist');
