import type { RequestMiddleware } from '@solidjs/start/middleware';
import { expectTypeOf } from 'expect-type';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';
import { verifyToken } from '../index';
import { CLERK_LOCALS, clerkLocals } from '../locals';
import { clerkMiddleware } from '../middleware';
import type { SessionAuthObjectWithRedirect } from '../types';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
});
const jwtKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const SESSION_TOKEN_CATEGORY = 'cl_B7d4PD111AAA';

const sessionToken = (
  category: string | undefined,
  claims: Record<string, unknown> = {}
) => {
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
      exp: now + 60,
      ...claims
    })
  ).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
};

const authenticate = async (token: string) => {
  const event = {
    request: new Request('https://app.example.com/api/me', {
      headers: { authorization: `Bearer ${token}` }
    }),
    response: { headers: new Headers() },
    locals: {}
  } as Parameters<RequestMiddleware>[0];
  await clerkMiddleware({
    publishableKey: TEST_PUBLISHABLE_KEY,
    secretKey: 'sk_test_fake',
    jwtKey
  })(event);
  return event;
};

describe('Clerk backend token categories through SolidStart middleware', () => {
  // @clerk/backend 3.28.0 stopped accepting session tokens without a `cat`
  // header, which clerkMiddleware() passes on unchanged.
  it.each([
    {
      category: undefined,
      authenticated: false,
      reason: 'token-type-mismatch'
    },
    { category: SESSION_TOKEN_CATEGORY, authenticated: true, reason: null },
    {
      category: 'cl_I7d4PD111III',
      authenticated: false,
      reason: 'token-type-mismatch'
    }
  ])(
    'authenticates=$authenticated for JWT category $category',
    async ({ category, authenticated, reason }) => {
      const event = await authenticate(sessionToken(category));

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

describe('verifyToken from clerk-solidjs/start/server', () => {
  it('rejects a session token without a `cat` header as token-invalid', async () => {
    await expect(
      verifyToken(sessionToken(undefined), { jwtKey })
    ).rejects.toMatchObject({ reason: 'token-invalid' });
  });

  it('verifies a session token with the session `cat` header', async () => {
    await expect(
      verifyToken(sessionToken(SESSION_TOKEN_CATEGORY), { jwtKey })
    ).resolves.toMatchObject({ sub: 'user_test', sid: 'sess_test' });
  });
});

// @clerk/backend 3.29.0 attributes agent sessions from the `agt` claim.
// clerkMiddleware() stores the backend's auth object, so `agent` carries over.
describe('agent attribution on the session auth object', () => {
  it.each([
    {
      name: 'an agent-task session',
      agt: { id: 'agent_123', tsk: 'agtsk_123' },
      expected: { type: 'agent', sub: 'agent_123', task_id: 'agtsk_123' }
    },
    {
      name: 'a Poppy session',
      agt: {
        id: 'https://agent.example',
        poppy: { session_id: 'protocol-session' }
      },
      expected: { type: 'agent', sub: 'https://agent.example' }
    },
    { name: 'a malformed agent claim', agt: { id: 123 }, expected: undefined },
    { name: 'an ordinary session', agt: undefined, expected: undefined }
  ])('exposes agent for $name', async ({ agt, expected }) => {
    const event = await authenticate(
      sessionToken(SESSION_TOKEN_CATEGORY, agt ? { agt } : {})
    );
    const sessionAuth = event.locals.auth as SessionAuthObjectWithRedirect;

    expect(sessionAuth.isAuthenticated).toBe(true);
    expect(sessionAuth.agent).toEqual(expected);
    expect(
      clerkLocals(event.locals)[CLERK_LOCALS]!.authenticate()
    ).toMatchObject(expected ? { agent: expected } : {});
    expect(sessionAuth).not.toHaveProperty('poppy');
  });

  it('has no agent when the token is rejected', async () => {
    const event = await authenticate(
      sessionToken(undefined, { agt: { id: 'agent_123' } })
    );

    expect(event.locals.auth.isAuthenticated).toBe(false);
    expect(event.locals.auth).not.toHaveProperty('agent');
  });

  it('types agent as the shared agent claim', () => {
    expectTypeOf<SessionAuthObjectWithRedirect['agent']>().toEqualTypeOf<
      import('@clerk/shared/types').AgentActClaim | undefined
    >();
  });
});
