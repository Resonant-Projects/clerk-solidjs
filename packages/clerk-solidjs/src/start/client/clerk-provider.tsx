import { htmlSafeJson } from '@clerk/shared/htmlSafeJson';
import { createMemo, JSX, splitProps } from 'solid-js';
import { getRequestEvent, isServer, useAssets } from 'solid-js/web';
import { ClerkProvider as SolidClerkProvider } from '../../contexts/clerk';
import type { ClerkState, SolidStartClerkProviderProps } from './types';
import { useAwaitableNavigate } from './use-awaitable-navigate';
import { mergeWithPublicEnvs, pickFromClerkInitState } from './utils';

declare global {
  interface Window {
    __clerk_init_state?: ClerkState;
  }
}

/**
 * Reads the Clerk state `clerkMiddleware` resolved for this request. On the
 * server it comes from the request event; in the browser, from the script the
 * server rendered into `<head>`, so the first client render already knows
 * whether the user is signed in and hydrates without a mismatch.
 */
const readClerkInitState = (): ClerkState | undefined => {
  if (isServer) {
    return getRequestEvent()?.locals.clerkInitialState as
      ClerkState | undefined;
  }
  return window.__clerk_init_state;
};

export function ClerkProvider(
  props: SolidStartClerkProviderProps
): JSX.Element {
  const [local, providerProps] = splitProps(props, ['children']);
  const awaitableNavigate = useAwaitableNavigate();

  const clerkInitState = readClerkInitState();

  if (isServer && clerkInitState) {
    const nonce = (getRequestEvent() as { nonce?: string } | undefined)?.nonce;
    useAssets(() => (
      <script
        nonce={nonce}
        // htmlSafeJson escapes the state for a script element. Text children
        // would be HTML-escaped, which corrupts script source.
        // eslint-disable-next-line solid/no-innerhtml
        innerHTML={`window.__clerk_init_state = ${htmlSafeJson(clerkInitState)};`}
      />
    ));
  }

  const { clerkSsrState, ...initStateProps } = pickFromClerkInitState(
    clerkInitState?.__internal_clerk_state
  );
  const envAndInitStateProps = mergeWithPublicEnvs(initStateProps);

  const mergedProps = createMemo(() => ({
    ...envAndInitStateProps,
    ...providerProps
  }));

  return (
    <SolidClerkProvider
      initialState={clerkSsrState}
      routerPush={(to: string) =>
        awaitableNavigate(to, {
          replace: false
        })
      }
      routerReplace={(to: string) =>
        awaitableNavigate(to, {
          replace: true
        })
      }
      {...mergedProps()}
    >
      {local.children}
    </SolidClerkProvider>
  );
}
