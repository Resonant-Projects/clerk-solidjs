import { Router } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { renderToString } from 'solid-js/web';
import { provideRequestEvent } from 'solid-js/web/storage';
import { describe, expect, it } from 'vitest';
import { ClerkFailed, ClerkLoaded, ClerkLoading, Show, useAuth } from '../..';
import { ClerkProvider } from '../../start';
import { signedInInitState } from '../../start/client/__tests__/fixtures';

const renderOnServer = (ui: () => JSX.Element, locals = {}) =>
  provideRequestEvent(
    {
      request: new Request('http://localhost:3000/'),
      response: { headers: new Headers() },
      locals
    } as any,
    () =>
      renderToString(() => (
        <Router url="/" root={() => <ClerkProvider>{ui()}</ClerkProvider>} />
      ))
  );

describe('control components on the server', () => {
  it('render ClerkLoading, as the browser does before clerk-js loads', () => {
    const html = renderOnServer(
      () => (
        <>
          <ClerkLoading>
            <p>loading</p>
          </ClerkLoading>
          <ClerkLoaded>
            <p>loaded</p>
          </ClerkLoaded>
          <ClerkFailed>
            <p>failed</p>
          </ClerkFailed>
        </>
      ),
      { clerkInitialState: signedInInitState() }
    );

    expect(html).toContain('loading');
    expect(html).not.toContain('loaded');
    expect(html).not.toContain('failed');
  });

  it('render <Show> from the request auth state', () => {
    const html = renderOnServer(
      () => (
        <>
          <Show when="signed-in" fallback={<p>in-fallback</p>}>
            <p>in-content</p>
          </Show>
          <Show when="signed-out">
            <p>out-content</p>
          </Show>
        </>
      ),
      { clerkInitialState: signedInInitState() }
    );

    expect(html).toContain('in-content');
    expect(html).not.toContain('in-fallback');
    expect(html).not.toContain('out-content');
  });

  it('render the fallback for a pending session', () => {
    const state = signedInInitState();
    state.__internal_clerk_state.__clerk_ssr_state = {
      ...state.__internal_clerk_state.__clerk_ssr_state,
      sessionStatus: 'pending'
    } as any;
    const html = renderOnServer(
      () => (
        <Show when="signed-in" fallback={<p>pending-fallback</p>}>
          <p>in-content</p>
        </Show>
      ),
      { clerkInitialState: state }
    );

    expect(html).toContain('pending-fallback');
    expect(html).not.toContain('in-content');
  });
});

describe('getToken on the server', () => {
  it('throws clerk_runtime_not_browser instead of waiting forever', async () => {
    let getToken!: ReturnType<typeof useAuth>['getToken'];
    const Probe = () => {
      getToken = useAuth().getToken;
      return null;
    };
    renderOnServer(() => <Probe />, {
      clerkInitialState: signedInInitState()
    });

    await expect(getToken()).rejects.toMatchObject({
      code: 'clerk_runtime_not_browser'
    });
  });
});
