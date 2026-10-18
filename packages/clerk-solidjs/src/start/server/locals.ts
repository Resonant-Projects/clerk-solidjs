import type { ClerkState } from '../client/types';
import type {
  ClerkRequestLocals,
  SessionAuthObjectWithRedirect
} from './types';

/**
 * The key `clerkMiddleware()` keeps its request state under. A symbol, so it
 * cannot clash with an app's own locals; `Symbol.for`, so every copy of this
 * package finds it.
 *
 * @internal
 */
export const CLERK_LOCALS = Symbol.for(
  '@resonant-projects/clerk-solidjs/locals'
);

/** @internal What `clerkMiddleware()` puts on `event.locals`. */
export type ClerkLocals = {
  auth?: SessionAuthObjectWithRedirect;
  clerkInitialState?: ClerkState;
  /** The request's CSP nonce, with `contentSecurityPolicy: { strict: true }`. */
  clerkNonce?: string;
  [CLERK_LOCALS]?: ClerkRequestLocals;
};

/**
 * `event.locals` typed with what the middleware stores, without a global
 * declaration that could clash with an app's own `auth` typing.
 *
 * @internal
 */
export const clerkLocals = (locals: object) => locals as ClerkLocals;
