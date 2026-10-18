import { renderToString } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider } from '../..';
import { TEST_PUBLISHABLE_KEY } from '../../__tests__/helpers/fake-clerk-js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ClerkProvider on the server', () => {
  it('fails the render for a missing publishable key', () => {
    expect(() =>
      renderToString(() => (
        <ClerkProvider>
          <p>app</p>
        </ClerkProvider>
      ))
    ).toThrow(/Clerk keys are missing/);
  });

  it('fails the render for a malformed publishable key', () => {
    expect(() =>
      renderToString(() => (
        <ClerkProvider publishableKey="not-a-key">
          <p>app</p>
        </ClerkProvider>
      ))
    ).toThrow(/publishableKey passed to Clerk is invalid/);
  });

  it('renders with a key from the env', () => {
    vi.stubEnv('CLERK_PUBLISHABLE_KEY', TEST_PUBLISHABLE_KEY);

    const html = renderToString(() => (
      <ClerkProvider>
        <p>app</p>
      </ClerkProvider>
    ));

    expect(html).toContain('app');
  });
});
