import {
  createMemoryHistory,
  MemoryRouter,
  Route,
  useLocation
} from '@solidjs/router';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { createResource, type JSX, Suspense } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignIn, UserProfile } from '..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../../__tests__/helpers/fake-clerk-js';
import { ClerkProvider as RootClerkProvider } from '../../../contexts';
import { useAwaitableNavigate } from '../use-awaitable-navigate';

afterEach(() => {
  cleanup();
});

describe('useAwaitableNavigate', () => {
  it('resolves after the new route has loaded and rendered', async () => {
    let release!: () => void;
    const slowData = new Promise<string>((resolve) => {
      release = () => resolve('slow data');
    });
    let navigate!: ReturnType<typeof useAwaitableNavigate>;

    const Home = () => {
      navigate = useAwaitableNavigate();
      return <p>home</p>;
    };
    const Slow = () => {
      const [data] = createResource(() => slowData);
      return <p>{data()}</p>;
    };

    const history = createMemoryHistory();
    render(() => (
      <MemoryRouter
        history={history}
        root={(props) => <Suspense>{props.children}</Suspense>}
      >
        <Route path="/" component={Home} />
        <Route path="/slow" component={Slow} />
      </MemoryRouter>
    ));
    expect(screen.getByText('home')).toBeTruthy();

    let settled = false;
    const navigation = navigate('/slow').then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    release();
    await navigation;
    expect(screen.getByText('slow data')).toBeTruthy();
  });

  it('resolves at once for the current location', async () => {
    let navigate!: ReturnType<typeof useAwaitableNavigate>;
    const Home = () => {
      navigate = useAwaitableNavigate();
      return <p>{useLocation().pathname}</p>;
    };
    render(() => (
      <MemoryRouter>
        <Route path="/" component={Home} />
      </MemoryRouter>
    ));

    await expect(navigate('/')).resolves.toBeUndefined();
  });
});

describe('SolidStart routing wrappers', () => {
  const renderAt = (url: string, route: string, ui: () => JSX.Element) => {
    const { clerkJS } = createFakeClerkJS();
    Object.assign(clerkJS, {
      mountUserProfile: vi.fn(),
      unmountUserProfile: vi.fn()
    });
    const history = createMemoryHistory();
    history.set({ value: url });
    render(() => (
      <MemoryRouter
        history={history}
        root={(props) => (
          <RootClerkProvider
            publishableKey={TEST_PUBLISHABLE_KEY}
            Clerk={clerkJS as any}
          >
            {props.children}
          </RootClerkProvider>
        )}
      >
        <Route path={route} component={ui} />
      </MemoryRouter>
    ));
    return clerkJS;
  };

  it('mount with path routing at the catch-all route, without a path prop', async () => {
    const clerkJS = renderAt('/sign-in/factor-one', '/sign-in/*rest', () => (
      <SignIn />
    ));

    await vi.waitFor(() => expect(clerkJS.mountSignIn).toHaveBeenCalled());
    expect(clerkJS.mountSignIn.mock.calls[0]![1]).toMatchObject({
      routing: 'path',
      path: '/sign-in'
    });
  });

  it('keep dynamic segments before the catch-all, and a path passed in', async () => {
    const clerkJS = renderAt(
      '/orgs/acme/profile/security',
      '/orgs/:slug/profile/*rest',
      () => <UserProfile />
    );
    await vi.waitFor(() =>
      expect((clerkJS as any).mountUserProfile).toHaveBeenCalled()
    );
    expect((clerkJS as any).mountUserProfile.mock.calls[0][1]).toMatchObject({
      routing: 'path',
      path: '/orgs/acme/profile'
    });
    expect(UserProfile.Page).toBeTypeOf('function');

    cleanup();
    const second = renderAt('/account/x', '/account/*rest', () => (
      <SignIn path="/custom" />
    ));
    await vi.waitFor(() => expect(second.mountSignIn).toHaveBeenCalled());
    expect(second.mountSignIn.mock.calls[0]![1]).toMatchObject({
      path: '/custom'
    });
  });

  /** Renders the routes, and returns the fake and a way to navigate. */
  const renderRoutes = (url: string, routes: () => JSX.Element) => {
    const { clerkJS } = createFakeClerkJS();
    Object.assign(clerkJS, {
      mountUserProfile: vi.fn(),
      unmountUserProfile: vi.fn()
    });
    const history = createMemoryHistory();
    history.set({ value: url });
    render(() => (
      <MemoryRouter
        history={history}
        root={(props) => (
          <RootClerkProvider
            publishableKey={TEST_PUBLISHABLE_KEY}
            Clerk={clerkJS as any}
          >
            {props.children}
          </RootClerkProvider>
        )}
      >
        {routes()}
      </MemoryRouter>
    ));
    return { clerkJS, go: (to: string) => history.set({ value: to }) };
  };

  /** The paths sent to clerk-js since mount, in order. */
  const pathsSent = (clerkJS: any, mount: string) => [
    clerkJS[mount].mock.calls[0]?.[1]?.path,
    ...clerkJS.__internal_updateProps.mock.calls
      .map(([update]: [any]) => update?.props?.path)
      .filter(Boolean)
  ];

  it("follow the route's parameters, which change without a remount", async () => {
    const { clerkJS, go } = renderRoutes('/orgs/acme/profile/security', () => (
      <Route
        path="/orgs/:slug/profile/*rest"
        component={() => <UserProfile />}
      />
    ));
    await vi.waitFor(() =>
      expect((clerkJS as any).mountUserProfile).toHaveBeenCalled()
    );

    go('/orgs/beta/profile');

    await vi.waitFor(() =>
      expect(pathsSent(clerkJS, 'mountUserProfile').at(-1)).toBe(
        '/orgs/beta/profile'
      )
    );
    expect((clerkJS as any).mountUserProfile).toHaveBeenCalledTimes(1);
  });

  it('take the path of the route that renders them, not a child route below it', async () => {
    const Account = (props: { children?: JSX.Element }) => (
      <>
        <UserProfile />
        {props.children}
      </>
    );
    const { clerkJS } = renderRoutes('/account/security', () => (
      <Route path="/account" component={Account}>
        <Route path="/security" component={() => <p>security</p>} />
      </Route>
    ));

    await vi.waitFor(() =>
      expect((clerkJS as any).mountUserProfile).toHaveBeenCalled()
    );
    expect((clerkJS as any).mountUserProfile.mock.calls[0][1]).toMatchObject({
      path: '/account'
    });
  });

  it('keep their path while the router moves on to another route', async () => {
    const { clerkJS, go } = renderRoutes('/sign-in/factor-one', () => (
      <>
        <Route path="/sign-in/*rest" component={() => <SignIn />} />
        <Route path="/elsewhere" component={() => <p>elsewhere</p>} />
      </>
    ));
    await vi.waitFor(() => expect(clerkJS.mountSignIn).toHaveBeenCalled());

    go('/elsewhere');
    await vi.waitFor(() => expect(screen.getByText('elsewhere')).toBeTruthy());

    expect(pathsSent(clerkJS, 'mountSignIn')).toEqual(['/sign-in']);
  });

  it('keep their path while a navigation away suspends on the next route', async () => {
    let release!: () => void;
    const slowData = new Promise<string>((resolve) => {
      release = () => resolve('slow data');
    });
    const Slow = () => {
      const [data] = createResource(() => slowData);
      return <p>{data()}</p>;
    };
    const { clerkJS } = createFakeClerkJS();
    const history = createMemoryHistory();
    history.set({ value: '/sign-in/factor-one' });
    render(() => (
      <MemoryRouter
        history={history}
        root={(props) => (
          <RootClerkProvider
            publishableKey={TEST_PUBLISHABLE_KEY}
            Clerk={clerkJS as any}
          >
            <Suspense>{props.children}</Suspense>
          </RootClerkProvider>
        )}
      >
        <Route path="/sign-in/*rest" component={() => <SignIn />} />
        <Route path="/slow" component={Slow} />
      </MemoryRouter>
    ));
    await vi.waitFor(() => expect(clerkJS.mountSignIn).toHaveBeenCalled());

    history.set({ value: '/slow' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await vi.waitFor(() => expect(screen.getByText('slow data')).toBeTruthy());

    expect(pathsSent(clerkJS, 'mountSignIn')).toEqual(['/sign-in']);
  });

  it('follow a route whose path alternatives first match where its layout does', async () => {
    const Account = (props: { children?: JSX.Element }) => (
      <>{props.children}</>
    );
    const { clerkJS, go } = renderRoutes('/account', () => (
      <Route path="/account" component={Account}>
        <Route
          path={['/*rest', '/:slug/profile/*rest']}
          component={() => <UserProfile />}
        />
      </Route>
    ));
    await vi.waitFor(() =>
      expect((clerkJS as any).mountUserProfile).toHaveBeenCalled()
    );

    go('/account/acme/profile');

    await vi.waitFor(() =>
      expect(pathsSent(clerkJS, 'mountUserProfile').at(-1)).toBe(
        '/account/acme/profile'
      )
    );
    expect((clerkJS as any).mountUserProfile).toHaveBeenCalledTimes(1);
  });

  it('reject a path with hash routing, as @clerk/react does', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() =>
      renderAt('/sign-in', '/sign-in', () => (
        <SignIn {...({ routing: 'hash', path: '/sign-in' } as any)} />
      ))
    ).toThrow(/path.*prop will only be respected/);
    consoleError.mockRestore();
  });
});
