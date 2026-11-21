import { OAuthTokenExchangeError } from '@clerk/backend/errors';
import { expectTypeOf } from 'expect-type';
import { describe, expect, it, vi } from 'vitest';
import type { Session, User } from '../index';
import { clerkClient, createClerkClient } from '../index';

// clerkClient() and createClerkClient() hand back @clerk/backend's client, so
// Backend API methods Clerk adds reach SolidStart apps without changes here.
// These pin the ones @clerk/backend 3.28.0, 3.29.0 and 3.30.0 added.
describe('Backend API methods on clerkClient()', () => {
  const client = clerkClient({ secretKey: 'sk_test_fake' });

  it('is the @clerk/backend client', () => {
    expectTypeOf(client).toEqualTypeOf<ReturnType<typeof createClerkClient>>();
  });

  it.each([
    ['sessions', 'updateSession'],
    ['users', 'mergeUser'],
    ['users', 'getUserList'],
    ['artifacts', 'getPoppyJson'],
    ['oauthApplications', '__experimental_exchangeToken'],
    ['organizations', 'updateOrganization']
  ] as const)('has %s.%s()', (api, method) => {
    const endpoint = client[api] as unknown as Record<string, unknown>;
    expect(endpoint[method]).toBeTypeOf('function');
  });

  it('types the new methods and parameters', () => {
    expectTypeOf(client.sessions.updateSession).parameters.toEqualTypeOf<
      [sessionId: string, params: { expireAt: Date }]
    >();
    expectTypeOf(client.sessions.updateSession).returns.toEqualTypeOf<
      Promise<Session>
    >();
    expectTypeOf<Parameters<typeof client.users.mergeUser>>().toExtend<
      [userId: string, params: { fromUserId: string; dryRun?: boolean }]
    >();
    expectTypeOf(client.users.mergeUser).returns.toEqualTypeOf<
      Promise<{ user: User; deletedUser: User }>
    >();
    expectTypeOf(client.artifacts.getPoppyJson).returns.toEqualTypeOf<
      Promise<unknown>
    >();
    expectTypeOf<Parameters<typeof client.users.getUserList>[0]>().toExtend<
      { startingAfter?: string } | undefined
    >();
    expectTypeOf({
      selfServeSsoEnabled: true,
      selfServeDirectorySyncEnabled: false
    }).toExtend<
      Parameters<typeof client.organizations.updateOrganization>[1]
    >();
  });
});

// @clerk/backend 3.30.0: an experimental OAuth 2.0 Token Exchange (RFC 8693)
// for an OAuth application. It checks its inputs before sending anything.
describe('clerkClient().oauthApplications.__experimental_exchangeToken()', () => {
  const client = clerkClient({ secretKey: 'sk_test_fake' });
  const params = {
    publishableKey: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
    clientId: 'client_1',
    clientSecret: 'secret_1',
    subjectToken: 'oat_1'
  };

  it('rejects an invalid resource with invalid_request, without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const exchange = client.oauthApplications.__experimental_exchangeToken({
        ...params,
        resource: 'https://api.example.com/#fragment'
      });
      await expect(exchange).rejects.toBeInstanceOf(OAuthTokenExchangeError);
      await expect(exchange).rejects.toMatchObject({
        code: 'invalid_request'
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('types the access token result', () => {
    expectTypeOf(
      client.oauthApplications.__experimental_exchangeToken
    ).returns.resolves.toMatchObjectType<{
      accessToken: string;
      tokenType: string;
      expiresIn?: number;
    }>();
  });
});
