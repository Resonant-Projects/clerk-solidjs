import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';

const backend = vi.hoisted(() => ({
  authenticateRequest: vi.fn()
}));

vi.mock('@clerk/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend')>()),
  createClerkClient: () => ({
    authenticateRequest: backend.authenticateRequest
  })
}));

import { clerkMiddleware } from '../middleware';

const signedOutAuth = {
  sessionId: null,
  userId: null,
  sessionClaims: null,
  isAuthenticated: false,
  tokenType: 'session_token'
};

const requestState = (headers: Headers, status = 'signed-out') => ({
  status,
  headers,
  isSignedIn: false,
  publishableKey: TEST_PUBLISHABLE_KEY,
  proxyUrl: '',
  domain: '',
  isSatellite: false,
  signInUrl: '',
  signUpUrl: '',
  afterSignInUrl: '',
  afterSignUpUrl: '',
  reason: 'session-token-and-uat-missing',
  message: '',
  toAuth: () => signedOutAuth
});

const fetchEvent = (url = 'http://localhost:3000/') =>
  ({
    request: new Request(url),
    response: { headers: new Headers() },
    locals: {} as Record<string, any>
  }) as any;

const middleware = clerkMiddleware({
  publishableKey: TEST_PUBLISHABLE_KEY,
  secretKey: 'sk_test_fake'
});

afterEach(() => {
  backend.authenticateRequest.mockReset();
});

describe('clerkMiddleware', () => {
  it('copies Clerk response headers, keeping every Set-Cookie', async () => {
    const headers = new Headers();
    headers.set('x-clerk-auth-status', 'signed-out');
    headers.set('x-clerk-auth-reason', 'session-token-and-uat-missing');
    headers.append('set-cookie', '__session=a; Path=/');
    headers.append('set-cookie', '__client_uat=0; Path=/');
    backend.authenticateRequest.mockResolvedValue(requestState(headers));

    const event = fetchEvent();
    const result = await middleware(event);

    expect(result).toBeUndefined();
    expect(event.response.headers.get('x-clerk-auth-status')).toBe(
      'signed-out'
    );
    expect(event.response.headers.get('x-clerk-auth-reason')).toBe(
      'session-token-and-uat-missing'
    );
    expect(event.response.headers.getSetCookie()).toEqual([
      '__session=a; Path=/',
      '__client_uat=0; Path=/'
    ]);
  });

  it('stores the auth object and the client init state in locals', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(new Headers()));

    const event = fetchEvent();
    await middleware(event);

    expect(event.locals.auth).toMatchObject({ userId: null });
    expect(event.locals.clerkInitialState.__internal_clerk_state).toMatchObject(
      {
        __clerk_ssr_state: signedOutAuth,
        __publishableKey: TEST_PUBLISHABLE_KEY
      }
    );
  });

  it('returns the handshake redirect with its headers', async () => {
    const headers = new Headers();
    headers.set('location', 'https://clerk.example.com/v1/client/handshake');
    headers.append('set-cookie', '__clerk_redirect_count=1');
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, 'handshake')
    );

    const result = (await middleware(fetchEvent())) as Response;

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe(
      'https://clerk.example.com/v1/client/handshake'
    );
    expect(result.headers.getSetCookie()).toEqual(['__clerk_redirect_count=1']);
  });
});
