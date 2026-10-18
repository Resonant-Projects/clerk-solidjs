import { eventMethodCalled } from '@clerk/shared/telemetry';
import type { SetActiveParams } from '@clerk/shared/types';
import { createMemo } from 'solid-js';
import { useClientContext } from '../../contexts/client';
import { useIsomorphicClerkContext } from '../../contexts/isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from '../use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from '../utils';

export const useSignIn = () => {
  useAssertWrappedByClerkProvider('useSignIn');

  const isomorphicClerk = useIsomorphicClerkContext();
  const client = useClientContext();

  recordTelemetryOnce(isomorphicClerk, () => eventMethodCalled('useSignIn'));

  const isLoaded = createMemo(() => !!client());
  const signIn = createMemo(() => client()?.signIn);

  const setActive = (params: SetActiveParams) => {
    return isomorphicClerk()?.setActive(params);
  };

  return {
    isLoaded,
    signIn,
    setActive
  };
};
