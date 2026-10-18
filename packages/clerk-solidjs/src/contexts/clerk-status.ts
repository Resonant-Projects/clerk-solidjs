import type { ClerkStatus } from '@clerk/shared/types';
import { Accessor, createContext, useContext } from 'solid-js';

export type ClerkLoadState = {
  /** `'loading'`, `'ready'`, `'degraded'` or `'error'`, as clerk-js reports it. */
  status: Accessor<ClerkStatus>;
  /** `true` once Clerk is `'ready'` or `'degraded'`. */
  loaded: Accessor<boolean>;
};

export const ClerkLoadStateContext = createContext<ClerkLoadState>();

/** The provider's load state, as accessors. */
export const useClerkLoadState = (): ClerkLoadState => {
  const ctx = useContext(ClerkLoadStateContext);
  if (!ctx) {
    throw new Error(
      'Clerk: useClerkLoadState can only be used within the <ClerkProvider /> component.'
    );
  }
  return ctx;
};
