import { eventMethodCalled } from '@clerk/shared/telemetry';
import { createMemo } from 'solid-js';
import { useClientContext } from '../contexts/client';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { IsomorphicClerk } from '../isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

export const useSignUp = () => {
  useAssertWrappedByClerkProvider('useSignUp');

  const isomorphicClerk = useIsomorphicClerkContext();
  const client = useClientContext();

  recordTelemetryOnce(isomorphicClerk, () => eventMethodCalled('useSignUp'));

  const isLoaded = createMemo(() => !!client());
  const signUp = createMemo(() => client()?.signUp);

  const setActive = (params: Parameters<IsomorphicClerk['setActive']>[0]) => {
    return isomorphicClerk()?.setActive(params);
  };

  return {
    isLoaded,
    signUp,
    setActive
  };
};
