import type { createMiddleware } from '@solidjs/start/middleware';
import { expectTypeOf } from 'expect-type';
import { provideRequestEvent } from 'solid-js/web/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';

const backend = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  clientOptions: [] as Record<string, unknown>[]
}));

vi.mock('@clerk/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend')>()),
  createClerkClient: (options: Record<string, unknown>) => {
    backend.clientOptions.push(options);
    return { authenticateRequest: backend.authenticateRequest };
  }
}));

import { auth } from '../auth';
import { clerkMiddleware } from '../middleware';

const signedOutAuth = () => ({
  sessionId: null,
  userId: null,
  sessionClaims: null,
  sessionStatus: null,
  isAuthenticated: false,
  tokenType: 'session_token'
});

const requestState = (
  headers = new Headers(),
  overrides: Record<string, unknown> = {}
) => ({
  status: 'signed-out',
  headers,
  isSignedIn: false,
  publishableKey: TEST_PUBLISHABLE_KEY,
  proxyUrl: '',
  domain: '',
  isSatellite: false,
  signInUrl: 'https://example.com/sign-in',
  signUpUrl: 'https://example.com/sign-up',
  afterSignInUrl: '',
  afterSignUpUrl: '',
  reason: 'session-token-and-uat-missing',
  message: '',
  toAuth: () => signedOutAuth(),
  ...overrides
});

const fetchEvent = (url = 'http://localhost:3000/', init?: RequestInit) =>
  ({
    request: new Request(url, init),
    response: { headers: new Headers() },
    locals: {} as Record<string, any>
  }) as any;

const clerkHeaders = () => {
  const headers = new Headers();
  headers.set('x-clerk-auth-status', 'signed-out');
  headers.append('set-cookie', '__session=a; Path=/');
  headers.append('set-cookie', '__client_uat=0; Path=/');
  return headers;
};

const options = {
  publishableKey: TEST_PUBLISHABLE_KEY,
  secretKey: 'sk_test_fake'
};

afterEach(() => {
  backend.authenticateRequest.mockReset();
  backend.clientOptions.length = 0;
  vi.unstubAllEnvs();
});

describe('clerkMiddleware types', () => {
  it('fits both forms of SolidStart 2 createMiddleware', () => {
    type MiddlewareArgs = Parameters<typeof createMiddleware>[0];
    expectTypeOf([clerkMiddleware()]).toMatchTypeOf<MiddlewareArgs>();
    expectTypeOf({
      onRequest: [clerkMiddleware()]
    }).toMatchTypeOf<MiddlewareArgs>();
  });

  it('types auth() by the tokens it accepts', () => {
    // The functions are passed, not called: auth() needs a request to run.
    const session = () => auth();
    const apiKey = () => auth({ acceptsToken: 'api_key' });
    expectTypeOf(session).returns.toHaveProperty('redirectToSignIn');
    expectTypeOf(session).returns.toHaveProperty('userId');
    expectTypeOf<ReturnType<typeof session>['userId']>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf(apiKey).returns.toHaveProperty('scopes');
  });
});

describe('clerkMiddleware in the onRequest form', () => {
  it('copies Clerk response headers, keeping every Set-Cookie', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));

    const event = fetchEvent();
    const result = await clerkMiddleware(options)(event);

    expect(result).toBeUndefined();
    expect(event.response.headers.get('x-clerk-auth-status')).toBe(
      'signed-out'
    );
    expect(event.response.headers.getSetCookie()).toEqual([
      '__session=a; Path=/',
      '__client_uat=0; Path=/'
    ]);
  });

  it('stores the auth object and the client init state in locals', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());

    const event = fetchEvent();
    await clerkMiddleware(options)(event);

    expect(event.locals.auth).toMatchObject({ userId: null });
    expect(event.locals.auth.redirectToSignIn).toBeTypeOf('function');
    expect(event.locals.clerkInitialState.__internal_clerk_state).toMatchObject(
      {
        __clerk_ssr_state: signedOutAuth(),
        __publishableKey: TEST_PUBLISHABLE_KEY
      }
    );
  });

  it('returns the handshake redirect with its headers', async () => {
    const headers = new Headers();
    headers.set('location', 'https://clerk.example.com/v1/client/handshake');
    headers.append('set-cookie', '__clerk_redirect_count=1');
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, { status: 'handshake' })
    );

    const result = (await clerkMiddleware(options)(fetchEvent())) as Response;

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe(
      'https://clerk.example.com/v1/client/handshake'
    );
    expect(result.headers.getSetCookie()).toEqual(['__clerk_redirect_count=1']);
  });
});

describe('clerkMiddleware as an h3 middleware', () => {
  /** Runs the middleware the way SolidStart 2's createMiddleware([...]) does. */
  const runH3 = (event: any, next: () => unknown) => {
    const h3Event = {
      context: {},
      res: { headers: event.response.headers, errHeaders: new Headers() }
    };
    return {
      h3Event,
      result: provideRequestEvent(event, () =>
        clerkMiddleware(options)(h3Event, next)
      )
    };
  };

  it('adds Clerk headers to a Response the route returns, at any status', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const event = fetchEvent('http://localhost:3000/api/thing');

    const { result } = runH3(event, async () => {
      expect(event.locals.auth).toMatchObject({ userId: null });
      return new Response('nope', { status: 403 });
    });
    const response = (await result) as Response;

    expect(response.status).toBe(403);
    expect(response.headers.get('x-clerk-auth-status')).toBe('signed-out');
    expect(response.headers.getSetCookie()).toEqual([
      '__session=a; Path=/',
      '__client_uat=0; Path=/'
    ]);
    // Not also on event.res, where h3 would add the cookies a second time.
    expect(event.response.headers.getSetCookie()).toEqual([]);
  });

  it("never adds one request's cookies to a Response the route reuses", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const shared = new Response(null, { status: 204 });

    const response = (await runH3(fetchEvent(), async () => shared)
      .result) as Response;

    expect(response).not.toBe(shared);
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(shared.headers.getSetCookie()).toEqual([]);
    expect(shared.headers.has('x-clerk-auth-status')).toBe(false);
  });

  it('keeps the WebSocket hooks h3 attaches to its upgrade Response', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const crossws = { open: vi.fn() };
    // What h3's defineWebSocketHandler returns.
    const upgrade = Object.assign(
      new Response('WebSocket upgrade is required.', { status: 426 }),
      { crossws }
    );

    const response = (await runH3(fetchEvent(), async () => upgrade)
      .result) as Response & { crossws?: unknown };

    expect(response.status).toBe(426);
    expect(response.crossws).toBe(crossws);
    expect(response.headers.get('x-clerk-auth-status')).toBe('signed-out');
  });

  it("keeps Clerk's headers when the Response holds its state under symbol keys", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    // Node 22's Response keeps its state and headers like this.
    const kHeaders = Symbol('headers');
    const route = Object.assign(
      new Response('ok', { headers: { 'x-route': 'yes' } }),
      { [kHeaders]: new Headers({ 'x-route': 'yes' }) }
    );

    const response = (await runH3(fetchEvent(), async () => route)
      .result) as Response;

    expect(Object.getOwnPropertySymbols(response)).not.toContain(kHeaders);
    expect(response.headers.get('x-route')).toBe('yes');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('puts headers on errHeaders for an error the route returns', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const event = fetchEvent();
    const failure = new Error('returned, not thrown');

    const { h3Event, result } = runH3(event, async () => failure);

    expect(await result).toBe(failure);
    expect(h3Event.res.errHeaders.getSetCookie()).toHaveLength(2);
    expect(event.response.headers.getSetCookie()).toEqual([]);
  });

  it('copies a Response with immutable headers to add them', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const event = fetchEvent();
    const immutable = Response.redirect('https://example.com/elsewhere', 302);

    const response = (await runH3(event, async () => immutable)
      .result) as Response;

    expect(response).not.toBe(immutable);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://example.com/elsewhere'
    );
    expect(response.headers.get('x-clerk-auth-status')).toBe('signed-out');
  });

  it('puts headers on event.res for a page render, which is not a Response', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const event = fetchEvent();

    const body = await runH3(event, async () => '<html></html>').result;

    expect(body).toBe('<html></html>');
    expect(event.response.headers.get('x-clerk-auth-status')).toBe(
      'signed-out'
    );
    expect(event.response.headers.getSetCookie()).toHaveLength(2);
  });

  it('keeps Clerk headers on the error response when the route throws', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState(clerkHeaders()));
    const event = fetchEvent();
    const failure = new Error('route failed');

    const { h3Event, result } = runH3(event, async () => {
      throw failure;
    });

    await expect(result).rejects.toBe(failure);
    expect(h3Event.res.errHeaders.getSetCookie()).toHaveLength(2);
  });

  it('returns the handshake redirect without running the route', async () => {
    const headers = new Headers();
    headers.set('location', 'https://clerk.example.com/v1/client/handshake');
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, { status: 'handshake' })
    );
    const next = vi.fn();

    const response = (await runH3(fetchEvent(), next).result) as Response;

    expect(response.status).toBe(307);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('clerkMiddleware options', () => {
  it('forwards every authenticateRequest option, and accepts any token type', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const organizationSyncOptions = { organizationPatterns: ['/orgs/:slug'] };

    await clerkMiddleware({
      ...options,
      machineSecretKey: 'ak_fake',
      organizationSyncOptions,
      satelliteAutoSync: true,
      clockSkewInMs: 1000,
      jwksCacheTtlInMs: 2000,
      skipJwksCache: true,
      headerType: ['JWT'],
      issuer: 'https://clerk.example.com',
      audience: 'my-api',
      authorizedParties: ['http://localhost:3000']
    })(fetchEvent());

    const [, authOptions] = backend.authenticateRequest.mock.calls[0]!;
    expect(authOptions).toMatchObject({
      acceptsToken: 'any',
      secretKey: 'sk_test_fake',
      machineSecretKey: 'ak_fake',
      publishableKey: TEST_PUBLISHABLE_KEY,
      organizationSyncOptions,
      satelliteAutoSync: true,
      clockSkewInMs: 1000,
      jwksCacheTtlInMs: 2000,
      skipJwksCache: true,
      headerType: ['JWT'],
      issuer: 'https://clerk.example.com',
      audience: 'my-api',
      authorizedParties: ['http://localhost:3000']
    });
    // One client, configured for the request and identifying the SDK.
    expect(backend.clientOptions.at(-1)).toMatchObject({
      secretKey: 'sk_test_fake',
      machineSecretKey: 'ak_fake',
      sdkMetadata: { name: `${PACKAGE_NAME}/start` },
      userAgent: `${PACKAGE_NAME}@${PACKAGE_VERSION}`
    });
  });

  it('uses an apiUrl passed in over the env and the publishable key', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    vi.stubEnv('CLERK_API_URL', 'https://api.from-env.example');

    await clerkMiddleware({ ...options, apiUrl: 'https://api.custom.example' })(
      fetchEvent()
    );

    expect(backend.authenticateRequest.mock.calls[0]![1].apiUrl).toBe(
      'https://api.custom.example'
    );
    expect(backend.clientOptions.at(-1)!.apiUrl).toBe(
      'https://api.custom.example'
    );
  });

  it('builds the client with an apiVersion passed in, which authenticateRequest cannot change', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    vi.stubEnv('CLERK_API_VERSION', 'v1');

    await clerkMiddleware({ ...options, apiVersion: 'v2' })(fetchEvent());

    expect(backend.clientOptions.at(-1)!.apiVersion).toBe('v2');
    expect(backend.authenticateRequest.mock.calls[0]![1].apiVersion).toBe('v2');
  });

  it('reads the env per request, not at import', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const middleware = clerkMiddleware();

    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_first');
    vi.stubEnv('CLERK_PUBLISHABLE_KEY', TEST_PUBLISHABLE_KEY);
    await middleware(fetchEvent());
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_second');
    await middleware(fetchEvent());

    expect(
      backend.authenticateRequest.mock.calls.map(([, o]) => o.secretKey)
    ).toEqual(['sk_test_first', 'sk_test_second']);
  });

  it('takes options from a callback, per request', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const callback = vi.fn(async ({ url }: { url: URL }) => ({
      ...options,
      signInUrl: `${url.origin}/login`
    }));

    const event = fetchEvent('http://localhost:3000/dashboard');
    await clerkMiddleware(callback)(event);

    expect(callback).toHaveBeenCalledWith({
      url: expect.any(URL),
      event
    });
    expect(callback.mock.calls[0]![0].url.pathname).toBe('/dashboard');
    expect(backend.authenticateRequest.mock.calls[0]![1]).toMatchObject({
      signInUrl: 'http://localhost:3000/login'
    });
  });

  it('throws the shared missing-secret-key message', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');

    await expect(
      clerkMiddleware({ publishableKey: TEST_PUBLISHABLE_KEY })(fetchEvent())
    ).rejects.toThrow(/Missing secretKey/);
  });
});

describe('auth()', () => {
  const apiKeyAuth = {
    tokenType: 'api_key',
    isAuthenticated: true,
    id: 'ak_123',
    subject: 'user_1',
    userId: 'user_1',
    scopes: ['read']
  };

  /** Runs the middleware, then `fn` inside the same request. */
  const inRequest = async <T>(
    state: object,
    fn: () => T,
    init?: RequestInit
  ) => {
    backend.authenticateRequest.mockResolvedValue(state);
    const event = fetchEvent('http://localhost:3000/api/data', init);
    await clerkMiddleware(options)(event);
    return provideRequestEvent(event, fn);
  };

  it('returns the session object by default, and machine tokens only when accepted', async () => {
    const state = requestState(new Headers(), {
      status: 'signed-in',
      toAuth: () => ({ ...apiKeyAuth })
    });

    const [session, apiKey, sessionOnly, any] = await inRequest(
      state,
      () => [
        auth(),
        auth({ acceptsToken: 'api_key' }),
        auth({ acceptsToken: 'session_token' }),
        auth({ acceptsToken: 'any' })
      ],
      { headers: { authorization: 'Bearer ak_123' } }
    );

    expect(session).toMatchObject({
      tokenType: 'session_token',
      isAuthenticated: false,
      userId: null
    });
    expect(apiKey).toMatchObject({
      tokenType: 'api_key',
      isAuthenticated: true,
      userId: 'user_1'
    });
    expect(sessionOnly).toMatchObject({ isAuthenticated: false });
    expect(any).toMatchObject({ tokenType: 'api_key' });
  });

  it('passes treatPendingAsSignedOut to the request state', async () => {
    const toAuth = vi.fn(() => signedOutAuth());
    await inRequest(requestState(new Headers(), { toAuth }), () =>
      auth({ treatPendingAsSignedOut: false })
    );

    expect(toAuth).toHaveBeenLastCalledWith({ treatPendingAsSignedOut: false });
  });

  it('gives the session object redirects to sign-in and sign-up that come back here', async () => {
    const { redirectToSignIn, redirectToSignUp } = await inRequest(
      requestState(),
      () => auth()
    );

    const toSignIn = redirectToSignIn();
    expect(toSignIn.status).toBe(307);
    const signInTarget = new URL(toSignIn.headers.get('location')!);
    expect(signInTarget.origin + signInTarget.pathname).toBe(
      'https://example.com/sign-in'
    );
    expect(signInTarget.searchParams.get('redirect_url')).toBe(
      'http://localhost:3000/api/data'
    );

    const toSignUp = redirectToSignUp({ returnBackUrl: '/welcome' });
    const signUpTarget = new URL(toSignUp.headers.get('location')!);
    expect(signUpTarget.pathname).toBe('/sign-up');
    expect(signUpTarget.searchParams.get('redirect_url')).toBe(
      'http://localhost:3000/welcome'
    );
  });

  it('sends a server function called from a page back to that page, not /_server', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const event = fetchEvent('http://localhost:3000/_server', {
      method: 'POST',
      headers: {
        'X-Server-Id': 'src/routes/protected.tsx#getProfile',
        referer: 'http://localhost:3000/protected?tab=2'
      }
    });
    await clerkMiddleware(options)(event);

    const fromServerFunction = provideRequestEvent(event, () =>
      auth().redirectToSignIn()
    );
    expect(
      new URL(fromServerFunction.headers.get('location')!).searchParams.get(
        'redirect_url'
      )
    ).toBe('http://localhost:3000/protected?tab=2');
  });

  it('sends a single-flight render back to the page it renders, not the one that called the action', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    // An action on /dashboard that redirects to /protected.
    const event = fetchEvent('http://localhost:3000/_server', {
      method: 'POST',
      headers: {
        'X-Server-Id': 'src/routes/dashboard.tsx#save',
        referer: 'http://localhost:3000/dashboard'
      }
    });
    await clerkMiddleware(options)(event);

    // SolidStart renders /protected with a page request that carries the
    // action's headers, X-Server-Id and Referer included.
    const pageEvent = {
      ...event,
      request: new Request('http://localhost:3000/protected?tab=2', {
        headers: new Headers(event.request.headers)
      })
    };
    const fromSingleFlight = provideRequestEvent(pageEvent, () =>
      auth().redirectToSignIn()
    );
    expect(
      new URL(fromSingleFlight.headers.get('location')!).searchParams.get(
        'redirect_url'
      )
    ).toBe('http://localhost:3000/protected?tab=2');
  });

  it('explains what is missing outside a request or without the middleware', () => {
    expect(() => auth()).toThrow(/outside a request/);
    expect(() => provideRequestEvent(fetchEvent(), () => auth())).toThrow(
      /needs clerkMiddleware\(\)/
    );
  });
});

describe('the state handed to the browser', () => {
  it('carries a server-only CLERK_CHECKOUT_CONTINUE_URL', async () => {
    vi.stubEnv('CLERK_CHECKOUT_CONTINUE_URL', '/billing/done');
    backend.authenticateRequest.mockResolvedValue(requestState());

    const event = fetchEvent();
    await clerkMiddleware(options)(event);

    expect(
      event.locals.clerkInitialState.__internal_clerk_state
        .__newSubscriptionRedirectUrl
    ).toBe('/billing/done');
  });
});
