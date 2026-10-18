import { provideRequestEvent } from 'solid-js/web/storage';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi
} from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';

const backend = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  clientOptions: [] as Record<string, unknown>[],
  proxy: vi.fn()
}));

vi.mock('@clerk/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend')>()),
  createClerkClient: (options: Record<string, unknown>) => {
    backend.clientOptions.push(options);
    return { authenticateRequest: backend.authenticateRequest };
  }
}));

vi.mock('@clerk/backend/proxy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend/proxy')>()),
  clerkFrontendApiProxy: backend.proxy
}));

import { clerkMiddleware } from '../middleware';

const SECRET_KEY = 'sk_test_fakesecretvalue';
const SESSION_COOKIE = '__session=eyJhbGciOiJSUzI1NiJ9.live.token; Path=/';

const signedOutAuth = () => ({
  sessionId: null,
  userId: null,
  orgId: null,
  sessionClaims: null,
  sessionStatus: null,
  isAuthenticated: false,
  tokenType: 'session_token',
  debug: () => ({ secretKey: 'sk_test' })
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
  signInUrl: '',
  signUpUrl: '',
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

const options = { publishableKey: TEST_PUBLISHABLE_KEY, secretKey: SECRET_KEY };

/** Runs the middleware the way SolidStart 2's createMiddleware([...]) does. */
const runH3 = (
  middleware: ReturnType<typeof clerkMiddleware>,
  event: any,
  next: () => unknown
) =>
  provideRequestEvent(event, () =>
    middleware(
      {
        context: {},
        res: { headers: event.response.headers, errHeaders: new Headers() }
      },
      next
    )
  );

/** The sources of one CSP directive. */
const directive = (policy: string | null, name: string) =>
  (policy ?? '')
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

afterEach(() => {
  backend.authenticateRequest.mockReset();
  backend.proxy.mockReset();
  backend.clientOptions.length = 0;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('frontendApiProxy', () => {
  it('sends a Frontend API request to Clerk without authenticating or running the route', async () => {
    backend.proxy.mockResolvedValue(new Response('{"client":{}}'));
    const next = vi.fn();
    const event = fetchEvent('http://localhost:3000/__clerk/v1/client', {
      method: 'POST',
      body: 'a=1'
    });

    const response = (await runH3(
      clerkMiddleware({ ...options, frontendApiProxy: { enabled: true } }),
      event,
      next
    )) as Response;

    expect(await response.text()).toBe('{"client":{}}');
    expect(backend.proxy).toHaveBeenCalledWith(event.request, {
      proxyPath: '/__clerk',
      publishableKey: TEST_PUBLISHABLE_KEY,
      secretKey: SECRET_KEY
    });
    // The body is still there for the proxy to forward.
    expect(event.request.bodyUsed).toBe(false);
    expect(backend.authenticateRequest).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('proxies in the onRequest form and at a custom path', async () => {
    backend.proxy.mockResolvedValue(new Response('ok'));
    const response = await clerkMiddleware({
      ...options,
      frontendApiProxy: { enabled: true, path: '/clerk-fapi' }
    })(fetchEvent('http://localhost:3000/clerk-fapi/v1/environment'));

    expect(await (response as Response).text()).toBe('ok');
    expect(backend.proxy.mock.calls[0][1].proxyPath).toBe('/clerk-fapi');
  });

  it("makes the proxy the browser's proxy URL, unless a proxyUrl is passed", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    await clerkMiddleware({ ...options, frontendApiProxy: { enabled: true } })(
      fetchEvent('http://localhost:3000/dashboard')
    );
    expect(backend.authenticateRequest.mock.calls[0][1].proxyUrl).toBe(
      'http://localhost:3000/__clerk'
    );
    expect(backend.clientOptions.at(-1)?.proxyUrl).toBe(
      'http://localhost:3000/__clerk'
    );

    await clerkMiddleware({
      ...options,
      proxyUrl: 'https://proxy.example.com/clerk',
      frontendApiProxy: { enabled: true }
    })(fetchEvent('http://localhost:3000/dashboard'));
    expect(backend.authenticateRequest.mock.calls[1][1].proxyUrl).toBe(
      'https://proxy.example.com/clerk'
    );
  });

  it('uses the public origin behind a reverse proxy', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    await clerkMiddleware({ ...options, frontendApiProxy: { enabled: true } })(
      fetchEvent('http://127.0.0.1:3000/', {
        headers: {
          'x-forwarded-host': 'app.example.com',
          'x-forwarded-proto': 'https'
        }
      })
    );
    expect(backend.authenticateRequest.mock.calls[0][1].proxyUrl).toBe(
      'https://app.example.com/__clerk'
    );
  });

  it('decides per request with a function, and does nothing when it says no', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const enabled = vi.fn((url: URL) => url.hostname !== 'localhost');
    const event = fetchEvent('http://localhost:3000/__clerk/v1/client');

    await clerkMiddleware({ ...options, frontendApiProxy: { enabled } })(event);

    expect(enabled).toHaveBeenCalledWith(expect.any(URL));
    expect(backend.proxy).not.toHaveBeenCalled();
    expect(backend.authenticateRequest).toHaveBeenCalled();
    expect(backend.authenticateRequest.mock.calls[0][1].proxyUrl).toBe('');
  });

  it('is not passed to authenticateRequest', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    await clerkMiddleware({
      ...options,
      debug: false,
      frontendApiProxy: { enabled: false },
      contentSecurityPolicy: {}
    })(fetchEvent());
    const passed = backend.authenticateRequest.mock.calls[0][1];
    expect(passed).not.toHaveProperty('frontendApiProxy');
    expect(passed).not.toHaveProperty('contentSecurityPolicy');
    expect(passed).not.toHaveProperty('debug');
    expect(passed).not.toHaveProperty('middlewareOptions');
  });
});

describe('contentSecurityPolicy', () => {
  it("sets a policy that allows the instance's Frontend API", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const event = fetchEvent();

    await clerkMiddleware({ ...options, contentSecurityPolicy: {} })(event);

    const policy = event.response.headers.get('content-security-policy');
    expect(directive(policy, 'connect-src')).toEqual(
      expect.arrayContaining(["'self'", 'clerk.example.com'])
    );
    expect(directive(policy, 'script-src')).toEqual(
      expect.arrayContaining(["'self'", 'https:', "'unsafe-inline'"])
    );
    expect(directive(policy, 'script-src')).not.toContain("'strict-dynamic'");
    // Clerk's UI uses data: SVGs.
    expect(directive(policy, 'img-src')).toContain('data:');
    expect(event.locals.clerkNonce).toBeUndefined();
  });

  it("allows the proxy's origin, including one on another origin", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const crossOrigin = fetchEvent();
    await clerkMiddleware({
      ...options,
      proxyUrl: 'https://proxy.example.com/clerk',
      contentSecurityPolicy: {}
    })(crossOrigin);
    expect(
      directive(
        crossOrigin.response.headers.get('content-security-policy'),
        'connect-src'
      )
    ).toEqual(
      expect.arrayContaining(['clerk.example.com', 'https://proxy.example.com'])
    );

    const sameOrigin = fetchEvent();
    await clerkMiddleware({
      ...options,
      frontendApiProxy: { enabled: true },
      contentSecurityPolicy: {}
    })(sameOrigin);
    expect(
      directive(
        sameOrigin.response.headers.get('content-security-policy'),
        'connect-src'
      )
    ).toContain('http://localhost:3000');
  });

  it('puts a new nonce in locals and the policy in strict mode', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const first = fetchEvent();
    const second = fetchEvent();
    const middleware = clerkMiddleware({
      ...options,
      contentSecurityPolicy: { strict: true }
    });

    await middleware(first);
    await middleware(second);

    const nonce = first.locals.clerkNonce;
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(second.locals.clerkNonce).not.toBe(nonce);
    const scripts = directive(
      first.response.headers.get('content-security-policy'),
      'script-src'
    );
    expect(scripts).toEqual(
      expect.arrayContaining(["'strict-dynamic'", `'nonce-${nonce}'`])
    );
    expect(scripts).not.toContain('https:');
    expect(scripts).not.toContain('http:');
  });

  it('merges your directives, and lets none replace one', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const event = fetchEvent();

    await clerkMiddleware({
      ...options,
      contentSecurityPolicy: {
        directives: {
          'img-src': ['https://cdn.example.com'],
          'frame-src': ['none'],
          'upgrade-insecure-requests': []
        }
      }
    })(event);

    const policy = event.response.headers.get('content-security-policy');
    expect(directive(policy, 'img-src')).toEqual([
      "'self'",
      'https://img.clerk.com',
      'data:',
      'https://cdn.example.com'
    ]);
    expect(directive(policy, 'frame-src')).toEqual(["'none'"]);
    expect(policy).toContain('upgrade-insecure-requests');
  });

  it('reports only, to a reporting endpoint, when asked', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const event = fetchEvent();

    await clerkMiddleware({
      ...options,
      contentSecurityPolicy: {
        reportOnly: true,
        reportTo: 'https://example.com/csp'
      }
    })(event);

    const headers = event.response.headers as Headers;
    expect(headers.get('content-security-policy')).toBeNull();
    expect(headers.get('content-security-policy-report-only')).toContain(
      'report-to csp-endpoint'
    );
    expect(headers.get('reporting-endpoints')).toBe(
      'csp-endpoint="https://example.com/csp"'
    );
  });

  it("replaces the route's own policy rather than adding a second", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());
    const response = (await runH3(
      clerkMiddleware({ ...options, contentSecurityPolicy: {} }),
      fetchEvent(),
      () =>
        new Response('page', {
          headers: { 'content-security-policy': "default-src 'none'" }
        })
    )) as Response;

    const policy = response.headers.get('content-security-policy');
    expect(policy).not.toContain("default-src 'none'");
    expect(directive(policy, 'connect-src')).toContain('clerk.example.com');
  });
});

describe('debug', () => {
  let log: MockInstance<typeof console.log>;
  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it("logs the request's options, state and auth, with keys and cookies cut short", async () => {
    const headers = new Headers();
    headers.append('set-cookie', SESSION_COOKIE);
    backend.authenticateRequest.mockResolvedValue(requestState(headers));

    await clerkMiddleware({ ...options, debug: true })(fetchEvent());

    const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('[clerk debug start: clerkMiddleware]');
    expect(output).toContain('[clerk debug end: clerkMiddleware]');
    expect(output).toContain('session-token-and-uat-missing');
    expect(output).toContain('"secretKey": "sk_test…"');
    expect(output).toContain('__session=…');
    expect(output).not.toContain(SECRET_KEY);
    expect(output).not.toContain('live.token');
  });

  it("never logs the incoming request's credentials", async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());

    await clerkMiddleware({ ...options, debug: true })(
      fetchEvent(
        'http://localhost:3000/dashboard?__clerk_db_jwt=dvb_devbrowsersecret&__clerk_handshake=eyJhandshake&tab=1',
        {
          headers: {
            authorization: 'Bearer ak_live_machinetokensecret',
            'proxy-authorization': 'Basic cHJveHlzZWNyZXQ=',
            cookie: `__session=eyJsessionsecret; __client_uat=1700000000; theme=dark`,
            referer:
              'http://localhost:3000/sign-in?__clerk_ticket=tkt_impersonationticket&x=2',
            'x-forwarded-uri': '/accept?__clerk_ticket=tkt_forwardedticket',
            link: '<http://localhost:3000/x?__clerk_ticket=tkt_linkticket>; rel=preload, <https://app.example.com/accept?a=1&__cl%65rk_ticket=tkt_encodedlinkticket>; rel=next',
            'x-custom-token':
              'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.c2lnbmF0dXJlc2VjcmV0',
            'x-network-path':
              '//app.example.com/accept?__clerk_ticket=tkt_networkpathticket',
            'x-original-url':
              '/accept?%5F%5Fclerk_ticket=tkt_encodedticket#%5F%5Fclerk_x=tkt_hashticket'
          }
        }
      )
    );

    const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    for (const secret of [
      'dvb_devbrowsersecret',
      'eyJhandshake',
      'ak_live_machinetokensecret',
      'eyJsessionsecret',
      '1700000000',
      'cHJveHlzZWNyZXQ',
      'tkt_impersonationticket',
      'tkt_forwardedticket',
      'tkt_encodedticket',
      'tkt_hashticket',
      'tkt_networkpathticket',
      'tkt_linkticket',
      'tkt_encodedlinkticket',
      'c2lnbmF0dXJlc2VjcmV0'
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('Bearer …');
    expect(output).toContain('__session=…; __client_uat=…; theme=…');
    expect(output).toContain('__clerk_db_jwt=…');
    expect(output).toContain('tab=1');
    expect(output).toContain('/sign-in?__clerk_ticket=…&x=2');
    expect(output).toContain('/accept?__clerk_ticket=…');
    expect(output).toContain('//app.example.com/accept?__clerk_ticket=…');
  });

  it("cuts Clerk's tokens out of a handshake redirect's Location", async () => {
    const headers = new Headers();
    const back = new URL('http://localhost:3000/dashboard');
    back.searchParams.set('__clerk_handshake', 'eyJnestedhandshake');
    const handshake = new URL('https://clerk.example.com/v1/client/handshake');
    handshake.searchParams.set('redirect_url', back.toString());
    handshake.searchParams.set('__clerk_db_jwt', 'dvb_handshakedevbrowser');
    headers.set('location', handshake.toString());
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, { status: 'handshake' })
    );

    const response = (await clerkMiddleware({ ...options, debug: true })(
      fetchEvent()
    )) as Response;

    // The redirect itself is untouched.
    expect(response.headers.get('location')).toBe(handshake.toString());
    const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).not.toContain('dvb_handshakedevbrowser');
    expect(output).not.toContain('eyJnestedhandshake');
    expect(output).toContain('clerk.example.com/v1/client/handshake');
  });

  it('logs nothing without it', async () => {
    backend.authenticateRequest.mockResolvedValue(requestState());

    await clerkMiddleware(options)(fetchEvent());

    // Solid warns about the missing request event this test runs without.
    const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).not.toContain('[clerk debug');
  });

  it('still logs what it has when authenticating fails', async () => {
    backend.authenticateRequest.mockRejectedValue(new Error('network down'));

    await expect(
      clerkMiddleware({ ...options, debug: true })(fetchEvent())
    ).rejects.toThrow('network down');

    const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('[clerk debug start: clerkMiddleware]');
    expect(output).toContain('options');
  });
});

describe('the handshake redirect on Netlify', () => {
  it('busts the cache of a redirect back to the app on a development instance', async () => {
    vi.stubEnv('NETLIFY', 'true');
    const headers = new Headers();
    headers.set('location', 'http://localhost:3000/dashboard');
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, { status: 'handshake' })
    );

    const response = (await clerkMiddleware(options)(fetchEvent())) as Response;

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/dashboard');
    expect(location.searchParams.get('__clerk_netlify_cache_bust')).toMatch(
      /^\d+$/
    );
  });

  it('leaves the redirect alone elsewhere', async () => {
    const headers = new Headers();
    headers.set('location', 'http://localhost:3000/dashboard');
    backend.authenticateRequest.mockResolvedValue(
      requestState(headers, { status: 'handshake' })
    );

    const response = (await clerkMiddleware(options)(fetchEvent())) as Response;

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/dashboard'
    );
  });
});
