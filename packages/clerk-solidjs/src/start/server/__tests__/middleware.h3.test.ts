import { defineHandler, H3, HTTPError, redirect, type H3Event } from 'h3';
import { provideRequestEvent } from 'solid-js/web/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_PUBLISHABLE_KEY } from '../../../__tests__/helpers/fake-clerk-js';

const backend = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));

vi.mock('@clerk/backend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clerk/backend')>()),
  createClerkClient: () => ({
    authenticateRequest: backend.authenticateRequest
  })
}));

import { clerkMiddleware } from '../middleware';

// How @solidjs/start 2.0.6 runs middleware (server/handler.js and
// server/fetchEvent.js): each one is decorated with the request's FetchEvent,
// and the route handler and middleware are mounted on an H3 app with
// `app.use()`. The deprecated `{ onRequest }` form wraps each function.
type Middleware = (event: H3Event, next: () => unknown) => unknown;

const getFetchEvent = (event: H3Event) =>
  ((event.context as Record<string, any>).solidFetchEvent ||= {
    request: event.req,
    response: event.res,
    locals: {},
    nativeEvent: event
  });

const decorate =
  (fn: Middleware): Middleware =>
  (event, next) =>
    provideRequestEvent(getFetchEvent(event), () => fn(event, next));

const decorateHandler = (fn: () => unknown) => (event: H3Event) =>
  provideRequestEvent(getFetchEvent(event), fn);

const onRequest =
  (fn: (fetchEvent: any) => unknown): Middleware =>
  async (event) => {
    const response = await fn(getFetchEvent(event));
    if (response) return response;
  };

const solidStartApp = (middleware: Middleware, route: () => unknown) =>
  new H3().use(
    defineHandler({
      middleware: [decorate(middleware)],
      handler: decorateHandler(route)
    })
  );

const clerkHeaders = () => {
  const headers = new Headers();
  headers.append('set-cookie', '__session=a; Path=/');
  headers.append('set-cookie', '__client_uat=0; Path=/');
  headers.set('x-clerk-auth-status', 'signed-out');
  return headers;
};

const signedOut = () => ({
  status: 'signed-out',
  headers: clerkHeaders(),
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
  secretKey: 'sk_test_123'
};

afterEach(() => {
  backend.authenticateRequest.mockReset();
});

const outcomes: [string, () => unknown, number][] = [
  ['a Response', () => new Response('ok'), 200],
  ['a 4xx Response', () => new Response('no', { status: 403 }), 403],
  ['an h3 redirect', () => redirect('/elsewhere'), 302],
  ['a body that is not a Response', () => ({ ok: true }), 200],
  [
    'a thrown error',
    () => {
      throw new HTTPError({ status: 401 });
    },
    401
  ],
  ['a returned error', () => new HTTPError({ status: 409 }), 409],
  ['nothing, which h3 answers with a 404', () => undefined, 404]
];

describe.each([
  ['as an h3 middleware', () => clerkMiddleware(options)],
  ['in the onRequest form', () => onRequest(clerkMiddleware(options))]
])('clerkMiddleware %s, on a real h3 app', (_, middleware) => {
  it.each(outcomes)(
    'adds Clerk headers exactly once to %s',
    async (_name, route, status) => {
      backend.authenticateRequest.mockResolvedValue(signedOut());
      const app = solidStartApp(middleware() as Middleware, route);

      const response = await app.fetch(
        new Request('http://localhost:3000/api/thing')
      );

      expect(response.status).toBe(status);
      expect(response.headers.get('x-clerk-auth-status')).toBe('signed-out');
      expect(response.headers.getSetCookie()).toEqual([
        '__session=a; Path=/',
        '__client_uat=0; Path=/'
      ]);
    }
  );
});
