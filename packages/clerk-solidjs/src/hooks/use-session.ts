import { eventMethodCalled } from '@clerk/shared/telemetry';
import { createMemo } from 'solid-js';
import { useClerkInstanceContext } from '../contexts/clerk-instance';
import { useSessionContext } from '../contexts/session';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

/**
 * The current session. While Clerk loads, `isLoaded()` is `false` and
 * `isSignedIn()` is `undefined`. As in Clerk Core 3, a session with pending
 * tasks is not signed in.
 */
export const useSession = () => {
  useAssertWrappedByClerkProvider('useSession');

  const session = useSessionContext();
  recordTelemetryOnce(useClerkInstanceContext(), () =>
    eventMethodCalled('useSession')
  );

  const isLoaded = createMemo(() => session() !== undefined);
  const isSignedIn = createMemo(() => {
    const current = session();
    if (current === undefined) return undefined;
    return !!current && current.status !== 'pending';
  });

  return {
    isLoaded,
    isSignedIn,
    session
  };
};
