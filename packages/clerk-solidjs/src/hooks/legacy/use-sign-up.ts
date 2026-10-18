import { eventMethodCalled } from '@clerk/shared/telemetry';
import type { SetActiveParams } from '@clerk/shared/types';
import { createMemo } from 'solid-js';
import { useClientContext } from '../../contexts/client';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from '../use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from '../utils';

export const useSignUp = () => {
  useAssertWrappedByClerkProvider('useSignUp');

  const isomorphicClerk = useIsomorphicClerkContext();
  const client = useClientContext();

  recordTelemetryOnce(isomorphicClerk, () => eventMethodCalled('useSignUp'));

  const isLoaded = createMemo(() => !!client());
  const signUp = createMemo(() => client()?.signUp);

  const setActive = (params: SetActiveParams) => {
    return isomorphicClerk()?.setActive(params);
  };

  return {
    isLoaded,
    signUp,
    setActive
  };
};
