import type {
  ClientResource,
  LoadedClerk,
  Resources
} from '@clerk/shared/types';
import { vi } from 'vitest';
import type { ClerkJSInternals } from '../../types';

/** A syntactically valid development key for `clerk.example.com`. */
export const TEST_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';

const emptyClient = {
  sessions: [],
  signedInSessions: []
} as unknown as ClientResource;

/**
 * A stand-in for a loaded clerk-js instance, passed to `ClerkProvider` through
 * its `Clerk` prop so nothing is fetched from the CDN. It is typed against the
 * Core 3 surface, so a member renamed upstream is a type error here.
 */
export const createFakeClerkJS = (initial: Partial<Resources> = {}) => {
  let state: Resources = {
    client: emptyClient,
    session: null,
    user: null,
    organization: null,
    ...initial
  };
  const listeners = new Set<(resources: Resources) => void>();

  const clerkJS = {
    loaded: false as boolean,
    load: vi.fn<(options?: unknown) => Promise<void>>(async () => {
      clerkJS.loaded = true;
    }),
    addListener: vi.fn((listener: (resources: Resources) => void) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    }),
    get client() {
      return state.client;
    },
    get session() {
      return state.session;
    },
    get user() {
      return state.user;
    },
    get organization() {
      return state.organization;
    },
    mountSignIn: vi.fn(),
    unmountSignIn: vi.fn(),
    mountUserButton: vi.fn(),
    unmountUserButton: vi.fn(),
    __internal_updateProps: vi.fn()
  } satisfies Partial<LoadedClerk & ClerkJSInternals> & {
    load: (options?: unknown) => Promise<void>;
  };

  /** Pushes new resources to every listener, as clerk-js does on a change. */
  const emit = (next: Partial<Resources>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  };

  return { clerkJS, emit };
};

export type FakeClerkJS = ReturnType<typeof createFakeClerkJS>['clerkJS'];

type SignalName = 'signIn' | 'signUp' | 'waitlist';
type FakeSignalValue = {
  errors: { fields: Record<string, unknown>; raw: unknown; global: unknown };
  fetchStatus: 'idle' | 'fetching';
} & Partial<Record<SignalName, object | null>>;

const emptyErrors = () => ({ fields: {}, raw: null, global: null });

/**
 * A stand-in for clerk-js's `__internal_state`. Each signal returns its
 * current value; `__internal_effect` runs its callback at once and again on
 * every `set`, until disposed, as clerk-js's alien-signals effect does.
 */
export const createFakeState = (
  initial: Partial<Record<SignalName, object | null>> = {}
) => {
  const effects = new Set<() => void>();
  const values: Record<SignalName, FakeSignalValue> = {
    signIn: {
      errors: emptyErrors(),
      fetchStatus: 'idle',
      signIn: initial.signIn ?? null
    },
    signUp: {
      errors: emptyErrors(),
      fetchStatus: 'idle',
      signUp: initial.signUp ?? null
    },
    waitlist: {
      errors: emptyErrors(),
      fetchStatus: 'idle',
      waitlist: initial.waitlist ?? {}
    }
  };
  const state = {
    signInSignal: () => values.signIn,
    signUpSignal: () => values.signUp,
    waitlistSignal: () => values.waitlist,
    __internal_effect: vi.fn((callback: () => void) => {
      effects.add(callback);
      callback();
      return () => {
        effects.delete(callback);
      };
    }),
    __internal_computed:
      <T>(getter: (previous?: T) => T) =>
      () =>
        getter(),
    get __internal_waitlist() {
      return values.waitlist.waitlist;
    }
  };
  /** Replaces part of one signal's value, as clerk-js does on an update. */
  const set = (name: SignalName, next: Partial<FakeSignalValue>) => {
    values[name] = { ...values[name], ...next };
    [...effects].forEach((effect) => effect());
  };
  return { state, set, effects };
};
