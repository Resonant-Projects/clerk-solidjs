import { deriveState } from '@clerk/shared/deriveState';
import type {
  ClientResource,
  InitialState,
  LoadedClerk,
  Resources
} from '@clerk/shared/types';
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  JSXElement,
  on,
  onCleanup,
  untrack
} from 'solid-js';
import { IsomorphicClerk } from '../isomorphic-clerk';
import { clearAuthenticatedQueries } from '../query/clerk-query-client';
import type { IsomorphicClerkOptions } from '../types';
import { AuthContextProvider } from './auth';
import { ClientContextProvider } from './client';
import { IsomorphicClerkContextProvider } from './isomorphic-clerk';
import { OrganizationContextProvider } from './organization';
import { SessionContextProvider } from './session';
import { UserContextProvider } from './user';

type ClerkContextProvider = {
  isomorphicClerkOptions: IsomorphicClerkOptions;
  initialState: InitialState | undefined;
  children: JSXElement;
};

export type ClerkContextProviderState = Resources;

export function ClerkContextProvider(props: ClerkContextProvider): JSX.Element {
  const { isomorphicClerk: clerk, loaded: clerkLoaded } =
    useLoadedIsomorphicClerk(() => props.isomorphicClerkOptions);

  const [state, setState] = createSignal<ClerkContextProviderState>({
    client: clerk().client as ClientResource,
    session: clerk().session,
    user: clerk().user,
    organization: clerk().organization
  });
  createEffect(() => {
    const fn = clerk().addListener((e) => setState({ ...e }));
    onCleanup(fn);
  });

  const derivedState = createMemo(() =>
    deriveState(clerkLoaded(), state(), props.initialState)
  );

  // Cached lists belong to the signed-in user. Clear them on sign-out even
  // when no list hook is mounted to clear its own, so the next user on this
  // page never sees them. clerk-js's signOut() first emits user `undefined`
  // (its transitive state), then `null`, so remember the last known user
  // across `undefined`.
  let lastKnownUserId: string | null | undefined;
  createEffect(
    on(
      () => derivedState().userId,
      (userId) => {
        if (userId === undefined) return;
        if (typeof lastKnownUserId === 'string' && userId === null) {
          clearAuthenticatedQueries();
        }
        lastKnownUserId = userId;
      }
    )
  );

  const clerkCtx = () => (clerkLoaded() ? clerk() : clerk());

  // Not memoized: clerk-js updates resources such as its Client singleton in
  // place and emits the same reference, so every emission must reach
  // consumers. The auth context memoizes its derived fields instead.
  const client = () => state().client;
  const session = () => derivedState().session;
  const organization = () => derivedState().organization;
  const user = () => derivedState().user;

  return (
    <IsomorphicClerkContextProvider
      clerk={clerkCtx as unknown as Accessor<LoadedClerk>}
    >
      <ClientContextProvider client={client}>
        <SessionContextProvider session={session}>
          <OrganizationContextProvider organization={organization}>
            <AuthContextProvider auth={derivedState}>
              <UserContextProvider user={user}>
                {props.children}
              </UserContextProvider>
            </AuthContextProvider>
          </OrganizationContextProvider>
        </SessionContextProvider>
      </ClientContextProvider>
    </IsomorphicClerkContextProvider>
  );
}

const useLoadedIsomorphicClerk = (
  options: Accessor<IsomorphicClerkOptions>
) => {
  const [loaded, setLoaded] = createSignal(false);
  const isomorphicClerk = createMemo(() =>
    IsomorphicClerk.getOrCreateInstance(untrack(options))
  );

  createEffect(
    on(
      () => options().appearance,
      (appearance) => {
        void isomorphicClerk().__internal_updateProps({
          appearance
        });
      }
    )
  );

  createEffect(
    on(
      () => options().localization,
      (localization) => {
        void isomorphicClerk().__internal_updateProps({
          options: {
            localization
          }
        });
      }
    )
  );

  createEffect(() => {
    isomorphicClerk().addOnLoaded(() => {
      setLoaded(true);
    });
  });

  onCleanup(() => {
    IsomorphicClerk.clearInstance();
  });

  return { isomorphicClerk, loaded };
};
