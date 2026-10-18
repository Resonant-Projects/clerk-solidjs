import { deriveState } from '@clerk/shared/deriveState';
import type {
  ClerkStatus,
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
import { isServer } from 'solid-js/web';
import { IsomorphicClerk } from '../isomorphic-clerk';
import { clearAuthenticatedQueries } from '../query/clerk-query-client';
import type { IsomorphicClerkOptions } from '../types';
import { AuthContextProvider } from './auth';
import { ClerkLoadStateContext } from './clerk-status';
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
  const {
    isomorphicClerk: clerk,
    status,
    loaded: clerkLoaded
  } = useLoadedIsomorphicClerk(() => props.isomorphicClerkOptions);

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

  // Reading `status()` makes anything that calls `useClerk()()` re-run when
  // Clerk loads or its status changes; the instance itself never changes.
  const clerkCtx = () => {
    status();
    return clerk();
  };

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
      <ClerkLoadStateContext.Provider value={{ status, loaded: clerkLoaded }}>
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
      </ClerkLoadStateContext.Provider>
    </IsomorphicClerkContextProvider>
  );
}

const useLoadedIsomorphicClerk = (
  options: Accessor<IsomorphicClerkOptions>
) => {
  const instance = IsomorphicClerk.getOrCreateInstance(untrack(options));
  const isomorphicClerk = () => instance;

  // clerk-js owns the status once it loads; IsomorphicClerk forwards it. The
  // server never loads clerk-js, so it renders the `'loading'` state the
  // browser starts in.
  const [status, setStatus] = createSignal<ClerkStatus>(instance.status);
  if (!isServer) {
    const onStatus = (next: ClerkStatus) => setStatus(next);
    instance.on('status', onStatus, { notify: true });
    onCleanup(() => instance.off('status', onStatus));
  }
  const loaded = createMemo(
    () => status() === 'ready' || status() === 'degraded'
  );

  createEffect(
    on(
      () => options().appearance,
      (appearance) => {
        void isomorphicClerk().__internal_updateProps({
          appearance
        });
      },
      // clerk-js receives the initial value through load().
      { defer: true }
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
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    IsomorphicClerk.clearInstance();
  });

  return { isomorphicClerk, status, loaded };
};
