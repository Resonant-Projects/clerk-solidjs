import { defineHandler, H3, type H3Event } from 'h3';
import { provideRequestEvent } from 'solid-js/web/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';

const backend = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getPoppyJson: vi.fn()
}));

vi.mock('@clerk/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend')>()),
  createClerkClient: () => ({
    authenticateRequest: backend.authenticateRequest,
    artifacts: { getPoppyJson: backend.getPoppyJson }
  })
}));

import { clerkMiddleware, type ClerkMiddleware } from '../middleware';

// Ported from the `Poppy middleware` tests of @clerk/nextjs 7.10.0.

const metadata = {
  protocol_version: '0.4',
  organization: { name: 'Company', domain: 'company.example' },
  auth: {
    issuer: 'https://clerk.company.example',
    scopes: {
      'poppy:browser-sign-in': 'Full website access',
      profile: 'Read profile'
    }
  },
  web: {
    browser_session_endpoint:
      'https://clerk.company.example/v1/poppy/browser_sessions',
    unscoped: true
  },
  extension: { unchanged: true }
};

const protectedResource = {
  resource: 'https://company.example',
  authorization_servers: ['https://clerk.company.example'],
  scopes_supported: ['poppy:browser-sign-in', 'profile'],
  bearer_methods_supported: ['header']
};

const signedOut = () => ({
  status: 'signed-out',
  headers: new Headers(),
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
  toAuth: () => ({
    sessionId: null,
    userId: null,
    sessionClaims: null,
    sessionStatus: null,
    isAuthenticated: false,
    tokenType: 'session_token'
  })
});

const options = {
  publishableKey: TEST_PUBLISHABLE_KEY,
  secretKey: 'sk_test_fake'
};

const fetchEvent = (url: string, init?: RequestInit) =>
  ({
    request: new Request(url, init),
    response: { headers: new Headers() },
    locals: {} as Record<string, any>
  }) as any;

const DISCOVERY_PATHS = [
  '/.well-known/poppy.json',
  '/.well-known/oauth-protected-resource'
];

afterEach(() => {
  backend.authenticateRequest.mockReset();
  backend.getPoppyJson.mockReset();
});

/** The middleware on an H3 app, run as @solidjs/start 2 runs it. */
const h3App = (middleware: ClerkMiddleware, route: () => unknown) => {
  const solidFetchEvent = (event: H3Event) =>
    ((event.context as Record<string, any>).solidFetchEvent ||= {
      request: event.req,
      response: event.res,
      locals: {},
      nativeEvent: event
    });
  return new H3().use(
    defineHandler({
      middleware: [
        (event, next) =>
          provideRequestEvent(solidFetchEvent(event), () =>
            middleware(event, next)
          ) as Promise<unknown>
      ],
      handler: route
    })
  );
};

describe('clerkMiddleware({ poppy: true })', () => {
  it.each([
    'https://company.example/.well-known/poppy.json',
    'https://company.example/.well-known/oauth-protected-resource',
    'https://preview.example/.well-known/poppy.json',
    'https://preview.example/.well-known/oauth-protected-resource'
  ])(
    'serves %s from the Backend API artifact before authentication',
    async (url) => {
      backend.getPoppyJson.mockResolvedValue(metadata);

      const response = await clerkMiddleware({ ...options, poppy: true })(
        fetchEvent(url)
      );

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(200);
      expect(await response!.json()).toEqual(
        url.endsWith('/poppy.json') ? metadata : protectedResource
      );
      expect(response!.headers.get('cache-control')).toBe('no-store');
      expect(backend.getPoppyJson).toHaveBeenCalledExactlyOnceWith();
      expect(backend.authenticateRequest).not.toHaveBeenCalled();
    }
  );

  it.each([
    { path: '/.well-known/poppy.json', method: 'POST' },
    { path: '/.well-known/poppy.json', method: 'HEAD' },
    { path: '/.well-known/oauth-protected-resource', method: 'POST' },
    { path: '/.well-known/oauth-protected-resource', method: 'OPTIONS' }
  ])(
    'rejects discovery $method $path without fetching the artifact',
    async ({ path, method }) => {
      const response = await clerkMiddleware({ ...options, poppy: true })(
        fetchEvent(`https://company.example${path}`, { method })
      );

      expect(response!.status).toBe(405);
      expect(response!.headers.get('allow')).toBe('GET');
      expect(backend.getPoppyJson).not.toHaveBeenCalled();
      expect(backend.authenticateRequest).not.toHaveBeenCalled();
    }
  );

  it.each(DISCOVERY_PATHS)(
    'leaves %s to the application when Poppy is off',
    async (path) => {
      backend.authenticateRequest.mockResolvedValue(signedOut());

      const response = await clerkMiddleware(options)(
        fetchEvent(`https://company.example${path}`)
      );

      expect(response).toBeUndefined();
      expect(backend.getPoppyJson).not.toHaveBeenCalled();
      expect(backend.authenticateRequest).toHaveBeenCalledOnce();
    }
  );

  it('authenticates every other path as before', async () => {
    backend.authenticateRequest.mockResolvedValue(signedOut());
    const event = fetchEvent('https://company.example/.well-known/other');

    const response = await clerkMiddleware({ ...options, poppy: true })(event);

    expect(response).toBeUndefined();
    expect(event.locals.auth).toMatchObject({ isAuthenticated: false });
    expect(backend.getPoppyJson).not.toHaveBeenCalled();
  });

  it('serves discovery for the public host behind a reverse proxy', async () => {
    backend.getPoppyJson.mockResolvedValue(metadata);

    const response = await clerkMiddleware({ ...options, poppy: true })(
      fetchEvent('http://localhost:3000/.well-known/poppy.json', {
        headers: {
          'x-forwarded-host': 'company.example',
          'x-forwarded-proto': 'https'
        }
      })
    );

    expect(await response!.json()).toEqual(metadata);
    expect(backend.authenticateRequest).not.toHaveBeenCalled();
  });

  it('reads poppy from per-request options', async () => {
    backend.getPoppyJson.mockResolvedValue(metadata);

    const response = await clerkMiddleware(() => ({ ...options, poppy: true }))(
      fetchEvent('https://company.example/.well-known/oauth-protected-resource')
    );

    expect(await response!.json()).toEqual(protectedResource);
  });

  it.each(DISCOVERY_PATHS)(
    'propagates an artifact failure for %s without made-up discovery',
    async (path) => {
      const failure = new Error('Backend artifact unavailable');
      backend.getPoppyJson.mockRejectedValue(failure);

      await expect(
        clerkMiddleware({ ...options, poppy: true })(
          fetchEvent(`https://company.example${path}`)
        )
      ).rejects.toBe(failure);
      expect(backend.authenticateRequest).not.toHaveBeenCalled();
    }
  );

  it('returns discovery from the h3 form without running the route', async () => {
    backend.getPoppyJson.mockResolvedValue(metadata);
    const route = vi.fn(() => 'route');

    const response = await h3App(
      clerkMiddleware({ ...options, poppy: true }),
      route
    ).request('https://company.example/.well-known/poppy.json');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(metadata);
    expect(route).not.toHaveBeenCalled();
    expect(backend.authenticateRequest).not.toHaveBeenCalled();
  });
});

// authenticateRequest() rejects a missing or malformed publishable key, and
// discovery runs before it, so discovery has to reject one itself.
describe('Poppy discovery with a bad publishable key', () => {
  const keys = [
    { name: 'missing', publishableKey: undefined, error: /missing/ },
    { name: 'empty', publishableKey: '', error: /missing/ },
    {
      name: 'malformed',
      publishableKey: 'pk_test_garbage',
      error: /not valid/
    },
    { name: 'not a key', publishableKey: 'not-a-key', error: /not valid/ }
  ];
  const cases = DISCOVERY_PATHS.flatMap((path) =>
    keys.map((key) => ({ path, ...key }))
  );
  const badOptions = (publishableKey: string | undefined) => ({
    secretKey: 'sk_test_fake',
    poppy: true,
    ...(publishableKey === undefined ? {} : { publishableKey })
  });

  beforeEach(() => {
    // No env fallback, so a missing option means a missing key.
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.stubEnv('CLERK_PUBLISHABLE_KEY', '');
    backend.getPoppyJson.mockResolvedValue(metadata);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(cases)(
    'throws for $path with a $name key in the onRequest form, before fetching',
    async ({ path, publishableKey, error }) => {
      await expect(
        clerkMiddleware(badOptions(publishableKey))(
          fetchEvent(`https://company.example${path}`)
        )
      ).rejects.toThrow(error);
      expect(backend.getPoppyJson).not.toHaveBeenCalled();
      expect(backend.authenticateRequest).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    'fails $path with a $name key in the h3 form, without serving it',
    async ({ path, publishableKey }) => {
      const route = vi.fn(() => 'route');

      const response = await h3App(
        clerkMiddleware(badOptions(publishableKey)),
        route
      ).request(`https://company.example${path}`);

      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).not.toBe('no-store');
      expect(backend.getPoppyJson).not.toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
    }
  );

  it('throws for a bad key on a non-GET discovery request too', async () => {
    await expect(
      clerkMiddleware(badOptions('pk_test_garbage'))(
        fetchEvent('https://company.example/.well-known/poppy.json', {
          method: 'POST'
        })
      )
    ).rejects.toThrow(/not valid/);
  });

  it('throws for a bad key from per-request options', async () => {
    await expect(
      clerkMiddleware(() => badOptions(undefined))(
        fetchEvent('https://company.example/.well-known/poppy.json')
      )
    ).rejects.toThrow(/missing/);
    expect(backend.getPoppyJson).not.toHaveBeenCalled();
  });
});
