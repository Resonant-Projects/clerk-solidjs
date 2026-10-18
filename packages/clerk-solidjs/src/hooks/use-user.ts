import { eventMethodCalled } from '@clerk/shared/telemetry';
import { createMemo } from 'solid-js';
import { useClerkInstanceContext } from '../contexts/clerk-instance';
import { useUserContext } from '../contexts/user';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

/**
 * The current user. While Clerk loads, `isLoaded()` is `false` and
 * `isSignedIn()` is `undefined`.
 */
export function useUser() {
  useAssertWrappedByClerkProvider('useUser');

  const user = useUserContext();
  recordTelemetryOnce(useClerkInstanceContext(), () =>
    eventMethodCalled('useUser')
  );

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
