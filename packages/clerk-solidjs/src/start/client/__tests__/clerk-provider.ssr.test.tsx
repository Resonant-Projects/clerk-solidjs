import { Router } from '@solidjs/router';
import { renderToString } from 'solid-js/web';
import { provideRequestEvent } from 'solid-js/web/storage';
import { describe, expect, it, vi } from 'vitest';
import { ClerkProvider } from '..';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';
import { Show } from '../../../components';
import { signedInInitState } from './fixtures';

const renderPage = (locals: Record<string, unknown>, nonce?: string) =>
  provideRequestEvent(
    {
      request: new Request('http://localhost:3000/'),
      response: { headers: new Headers() },
      locals,
      nonce
    } as any,
    () =>
      renderToString(() => (
        <html>
          <head />
          <body>
            <Router
              url="/"
              root={() => (
                <ClerkProvider>
                  <Show when="signed-in">
                    <p>signed-in</p>
                  </Show>
                  <Show when="signed-out">
                    <p>signed-out</p>
                  </Show>
                </ClerkProvider>
              )}
            />
          </body>
        </html>
      ))
  );

describe('SolidStart ClerkProvider on the server', () => {
  it('renders from the request state and hands it to the browser in <head>', () => {
    const html = renderPage(
      { clerkInitialState: signedInInitState() },
      'nonce-123'
    );

    expect(html).toContain('signed-in');
    expect(html).not.toContain('signed-out');

    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain('<script nonce="nonce-123">');
    expect(head).toContain('window.__clerk_init_state = ');
    expect(head).toContain('"userId":"user_1"');
  });

  it('escapes the state so a value cannot close the script element', () => {
    const html = renderPage({
      clerkInitialState: signedInInitState({
        __signInUrl: '/sign-in</script><script>alert(1)</script>'
      })
    });

    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).not.toContain('</script><script>alert(1)');
    expect(head).toContain('\\u003c\\u002fscript\\u003e');
  });

  it('renders no state script when the middleware did not run', () => {
    // Without the middleware's state, the key comes from the env.
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', TEST_PUBLISHABLE_KEY);
    const html = renderPage({});
    vi.unstubAllEnvs();

    expect(html).not.toContain('__clerk_init_state');
  });
});
