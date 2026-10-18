import { eventMethodCalled } from '@clerk/shared/telemetry';
import { createMemo } from 'solid-js';
import { useClerkInstanceContext } from '../contexts/clerk-instance';
import { useClientContext } from '../contexts/client';
import { IsomorphicClerk } from '../isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

export const useSessionList = () => {
  useAssertWrappedByClerkProvider('useSessionList');

  const isomorphicClerk = useClerkInstanceContext();
  const client = useClientContext();
  recordTelemetryOnce(isomorphicClerk, () =>
    eventMethodCalled('useSessionList')
  );

  const isLoaded = createMemo(() => !!client());
  const sessions = createMemo(() => client()?.sessions);

  const setActive = (params: Parameters<IsomorphicClerk['setActive']>[0]) => {
    return isomorphicClerk()?.setActive(params);
  };

  return {
    isLoaded,
    sessions,
    setActive
  };
};
