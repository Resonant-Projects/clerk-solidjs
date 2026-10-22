import type { RequestMiddleware } from '@solidjs/start/middleware';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';
import { CLERK_LOCALS, clerkLocals } from '../locals';
import { clerkMiddleware } from '../middleware';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const sessionToken = (category: string | undefined) => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key', cat: category })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://clerk.example.com',
      sub: 'user_test',
      sid: 'sess_test',
      iat: now,
      nbf: now - 1,
      exp: now + 60
    })
  ).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
};

describe('Clerk backend token categories through SolidStart middleware', () => {
  it.each([
    { category: undefined, authenticated: true, reason: null },
    { category: 'cl_B7d4PD111AAA', authenticated: true, reason: null },
    {
      category: 'cl_I7d4PD111III',
      authenticated: false,
      reason: 'token-type-mismatch'
    }
  ])(
    'authenticates=$authenticated for JWT category $category',
    async ({ category, authenticated, reason }) => {
      const event = {
        request: new Request('https://app.example.com/api/me', {
          headers: { authorization: `Bearer ${sessionToken(category)}` }
        }),
        response: { headers: new Headers() },
        locals: {}
      } as Parameters<RequestMiddleware>[0];

      await clerkMiddleware({
        publishableKey: TEST_PUBLISHABLE_KEY,
        secretKey: 'sk_test_fake',
        jwtKey: publicKey.export({ type: 'spki', format: 'pem' }).toString()
      })(event);

      expect(event.locals.auth).toMatchObject({
        isAuthenticated: authenticated,
        userId: authenticated ? 'user_test' : null,
        sessionId: authenticated ? 'sess_test' : null
      });
      const state = clerkLocals(event.locals)[CLERK_LOCALS]!.requestState;
      expect(state.status).toBe(authenticated ? 'signed-in' : 'signed-out');
      expect(state.reason ?? null).toBe(reason);
    }
  );
});
