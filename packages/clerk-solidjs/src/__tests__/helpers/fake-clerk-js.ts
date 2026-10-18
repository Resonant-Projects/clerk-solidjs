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
    load: vi.fn(async () => {
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
