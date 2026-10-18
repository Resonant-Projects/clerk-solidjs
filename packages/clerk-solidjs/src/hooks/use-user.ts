import { createMemo } from 'solid-js';
import { useUserContext } from '../contexts/user';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';

/**
 * The current user. While Clerk loads, `isLoaded()` is `false` and
 * `isSignedIn()` is `undefined`.
 */
export function useUser() {
  useAssertWrappedByClerkProvider('useUser');

  const user = useUserContext();

  const isLoaded = createMemo(() => user() !== undefined);
  const isSignedIn = createMemo(() =>
    user() === undefined ? undefined : user() !== null
  );

  return {
    isLoaded,
    isSignedIn,
    user
  };
}
