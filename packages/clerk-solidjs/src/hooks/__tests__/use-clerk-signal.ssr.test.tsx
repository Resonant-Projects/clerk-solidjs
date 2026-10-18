import { renderToString } from 'solid-js/web';
import { describe, expect, it } from 'vitest';
import { ClerkProvider, useSignIn, useSignUp, useWaitlist } from '../..';
import { TEST_PUBLISHABLE_KEY } from '../../__tests__/helpers/fake-clerk-js';

describe('the Core 3 hooks on the server', () => {
  it('render the defaults the browser starts with', () => {
    const Forms = () => {
      const signIn = useSignIn();
      const signUp = useSignUp();
      const waitlist = useWaitlist();
      return (
        <p>
          {signIn.signIn.status}|{signIn.fetchStatus}|
          {String(signIn.errors.fields.identifier)}|{signUp.signUp.status}|
          {waitlist.waitlist.id || 'no-waitlist'}
        </p>
      );
    };

    const html = renderToString(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY}>
        <Forms />
      </ClerkProvider>
    ));

    expect(html.replace(/<!--[^>]*-->/g, '')).toContain(
      'needs_identifier|idle|null|missing_requirements|no-waitlist'
    );
  });

  it('reject a method called on the server', async () => {
    let result: Promise<unknown> | undefined;
    const Form = () => {
      result = useSignIn().signIn.create({ identifier: 'a@example.com' });
      return null;
    };

    renderToString(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY}>
        <Form />
      </ClerkProvider>
    ));

    await expect(result).rejects.toThrow(/not supported on the server/);
  });
});
