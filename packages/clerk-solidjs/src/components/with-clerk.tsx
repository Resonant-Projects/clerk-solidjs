import type { LoadedClerk } from '@clerk/shared/types';
import { Accessor, Component, Show } from 'solid-js';
import { useClerkLoadState } from '../contexts/clerk-status';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from '../hooks/use-assert-wrapped-by-clerk-provider';
import type { DistributiveOmit } from '../types';

type WithClerkOptions = {
  component: string;
  /**
   * Render before Clerk loads, and on the server. IsomorphicClerk queues
   * mounts, modals and redirects until clerk-js is ready.
   */
  renderWhileLoading?: boolean;
};

export const withClerk = <P extends { clerk: Accessor<LoadedClerk> }>(
  Component: Component<P>,
  displayNameOrOptions?: string | WithClerkOptions
) => {
  const options =
    typeof displayNameOrOptions === 'string'
      ? { component: displayNameOrOptions }
      : displayNameOrOptions;
  const displayName = options?.component || Component.name || 'Component';
  const renderWhileLoading = !!options?.renderWhileLoading;

  // Distributive, so union props such as a button's modal-only `appearance`
  // survive.
  return (props: DistributiveOmit<P, 'clerk'>) => {
    useAssertWrappedByClerkProvider(displayName);
    const clerk = useIsomorphicClerkContext();
    const { loaded } = useClerkLoadState();

    return (
      <Show when={renderWhileLoading || loaded()}>
        <Component {...(props as unknown as P)} clerk={clerk} />
      </Show>
    );
  };
};
