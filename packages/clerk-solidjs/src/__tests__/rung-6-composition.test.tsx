import type {
  LoadedClerk,
  SignInResource,
  SignUpResource,
  UserResource
} from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import {
  type Accessor,
  createRoot,
  createSignal,
  ErrorBoundary,
  type JSX,
  onCleanup
} from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  OrganizationSwitcher,
  useEmailLink,
  UserButton,
  UserProfileModal
} from '..';
import { ClerkInstanceContextProvider } from '../contexts/clerk-instance';
import { ClerkLoadStateContext } from '../contexts/clerk-status';
import type { UseEmailLinkSignInReturn } from '../hooks/use-email-link';
import {
  MultisessionAppSupport,
  useDerivedAuth,
  useRoutingProps
} from '../internal';
import { IsomorphicClerk } from '../isomorphic-clerk';
import type { ClerkJSInternals } from '../types';
import { createCustomElementPortals } from '../utils/custom-element-portals';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from './helpers/fake-clerk-js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const signedInAs = (id: string) => {
  const user = { id, organizationMemberships: [] } as unknown as UserResource;
  return {
    user,
    session: {
      id: `sess_${id}`,
      status: 'active',
      user,
      lastActiveToken: { jwt: { claims: {} } }
    } as any
  };
};

describe('one ClerkProvider per tree', () => {
  it('throws for a ClerkProvider inside another', () => {
    const { clerkJS } = createFakeClerkJS();
    let caught: unknown;
    render(() => (
      <ErrorBoundary
        fallback={(error) => {
          caught = error;
          return null;
        }}
      >
        <ClerkProvider
          publishableKey={TEST_PUBLISHABLE_KEY}
          Clerk={clerkJS as any}
        >
          <ClerkProvider
            publishableKey={TEST_PUBLISHABLE_KEY}
            Clerk={clerkJS as any}
          >
            <p>inner</p>
          </ClerkProvider>
        </ClerkProvider>
      </ErrorBoundary>
    ));
    expect(String(caught)).toContain('multiple <ClerkProvider> components');
  });

  it('allows one in each of two separate roots, at the same time', () => {
    const first = createFakeClerkJS().clerkJS;
    const second = createFakeClerkJS().clerkJS;
    render(() => (
      <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={first as any}>
        <p>first island</p>
      </ClerkProvider>
    ));
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={second as any}
      >
        <p>second island</p>
      </ClerkProvider>
    ));
    expect(screen.getByText('first island')).toBeTruthy();
    expect(screen.getByText('second island')).toBeTruthy();
  });

  it('keeps the shared Clerk while another root still uses it', () => {
    const create = vi.spyOn(IsomorphicClerk, 'getOrCreateInstance');
    const { clerkJS } = createFakeClerkJS();
    const island = () =>
      render(() => (
        <ClerkProvider
          publishableKey={TEST_PUBLISHABLE_KEY}
          Clerk={clerkJS as any}
        >
          <p>island</p>
        </ClerkProvider>
      ));
    const first = island();
    island();
    first.unmount();
    // A root mounted after one of two unmounted joins the one still there.
    island();

    const instances = new Set(create.mock.results.map(({ value }) => value));
    expect(create).toHaveBeenCalledTimes(3);
    expect(instances.size).toBe(1);
  });
});

describe('useEmailLink', () => {
  const resource = () => {
    const flows = {
      startEmailLinkFlow: vi.fn(async () => ({ status: 'complete' })),
      cancelEmailLinkFlow: vi.fn()
    };
    return {
      flows,
      resource: {
        createEmailLinkFlow: vi.fn(() => flows)
      } as unknown as SignInResource
    };
  };

  it('returns plain functions, and makes the flow only when it starts', async () => {
    const { resource: signIn, flows } = resource();
    let link!: UseEmailLinkSignInReturn;
    const dispose = createRoot((dispose) => {
      link = useEmailLink(() => signIn);
      return dispose;
    });

    expect(signIn.createEmailLinkFlow).not.toHaveBeenCalled();
    await expect(
      link.startEmailLinkFlow({ emailAddressId: 'idn_1', redirectUrl: '/v' })
    ).resolves.toEqual({ status: 'complete' });
    expect(flows.startEmailLinkFlow).toHaveBeenCalledWith({
      emailAddressId: 'idn_1',
      redirectUrl: '/v'
    });
    link.cancelEmailLinkFlow();
    expect(flows.cancelEmailLinkFlow).toHaveBeenCalledTimes(1);

    dispose();
    expect(flows.cancelEmailLinkFlow).toHaveBeenCalledTimes(2);
  });

  it('type-checks a union of resources, as it did before 4.3', () => {
    // Compiled, not run: a wrapper typed for several resources still calls it.
    const wrapper = (resource: Accessor<SignInResource | SignUpResource>) =>
      useEmailLink(resource);
    expectTypeOf(wrapper).toBeFunction();
  });

  it('still works called the old way, with a deprecation warning', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { resource: signIn, flows } = resource();
    createRoot(async (dispose) => {
      const link = useEmailLink(() => signIn);
      await link.startEmailLinkFlow()({
        emailAddressId: 'idn_1',
        redirectUrl: '/v'
      });
      link.cancelEmailLinkFlow()();
      dispose();
    });
    await vi.waitFor(() => expect(flows.startEmailLinkFlow).toHaveBeenCalled());
    expect(flows.cancelEmailLinkFlow).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).toContain('startEmailLinkFlow');
  });

  it('cancels the flow of a resource the accessor no longer returns', async () => {
    const first = resource();
    const second = resource();
    const [current, setCurrent] = createSignal(first.resource);
    let link!: UseEmailLinkSignInReturn;
    const dispose = createRoot((dispose) => {
      link = useEmailLink(current);
      return dispose;
    });
    // Effects run after the root is set up.
    await Promise.resolve();
    await link.startEmailLinkFlow({ emailAddressId: 'a', redirectUrl: '/v' });

    setCurrent(second.resource);
    expect(first.flows.cancelEmailLinkFlow).toHaveBeenCalledTimes(1);
    await link.startEmailLinkFlow({ emailAddressId: 'b', redirectUrl: '/v' });
    expect(second.flows.startEmailLinkFlow).toHaveBeenCalled();
    dispose();
  });
});

const createFakeClerk = () =>
  ({
    loaded: true,
    mountUserButton: vi.fn(),
    unmountUserButton: vi.fn(),
    mountOrganizationSwitcher: vi.fn(),
    unmountOrganizationSwitcher: vi.fn(),
    __internal_updateProps: vi.fn()
  }) satisfies Partial<LoadedClerk & ClerkJSInternals>;

const renderWithClerk = (
  clerk: ReturnType<typeof createFakeClerk>,
  ui: () => JSX.Element
) =>
  render(() => (
    <ClerkInstanceContextProvider clerk={() => clerk as any}>
      <ClerkLoadStateContext.Provider
        value={{ status: () => 'ready', loaded: () => true }}
      >
        {ui()}
      </ClerkLoadStateContext.Provider>
    </ClerkInstanceContextProvider>
  ));

describe('__experimental_asProvider and the Outlet', () => {
  it('renders the children instead of the button, and the button where the Outlet is', () => {
    const clerk = createFakeClerk();
    const [showName, setShowName] = createSignal(true);
    renderWithClerk(clerk, () => (
      <UserButton __experimental_asProvider showName={showName()}>
        <UserButton.UserProfilePage
          label="Settings"
          url="settings"
          labelIcon={<svg />}
        >
          <p>Settings body</p>
        </UserButton.UserProfilePage>
        <nav data-testid="layout">
          <UserButton.__experimental_Outlet afterSwitchSessionUrl="/home" />
        </nav>
      </UserButton>
    ));

    // The provider mounts nothing itself; the Outlet does, inside the layout.
    expect(clerk.mountUserButton).toHaveBeenCalledTimes(1);
    const [node, props] = clerk.mountUserButton.mock.calls[0]!;
    expect(screen.getByTestId('layout').contains(node as Node)).toBe(true);
    expect(props).toMatchObject({
      showName: true,
      afterSwitchSessionUrl: '/home',
      userProfileProps: {
        customPages: [expect.objectContaining({ label: 'Settings' })]
      }
    });

    setShowName(false);
    const update = clerk.__internal_updateProps.mock.calls.at(-1)![0];
    expect(update.node).toBe(node);
    expect(update.props).toMatchObject({
      showName: false,
      afterSwitchSessionUrl: '/home'
    });
  });

  it("shows the provider's fallback where the Outlet is, until Clerk renders", () => {
    const clerk = createFakeClerk();
    renderWithClerk(clerk, () => (
      <UserButton
        __experimental_asProvider
        fallback={<p data-testid="button-fallback">Loading button</p>}
      >
        <div data-testid="slot">
          <UserButton.__experimental_Outlet />
        </div>
      </UserButton>
    ));
    expect(
      screen.getByTestId('slot').contains(screen.getByTestId('button-fallback'))
    ).toBe(true);
  });

  it('works the same for OrganizationSwitcher', () => {
    const clerk = createFakeClerk();
    renderWithClerk(clerk, () => (
      <OrganizationSwitcher __experimental_asProvider hidePersonal>
        <div data-testid="slot">
          <OrganizationSwitcher.__experimental_Outlet />
        </div>
      </OrganizationSwitcher>
    ));
    const [node, props] = clerk.mountOrganizationSwitcher.mock.calls[0]!;
    expect(screen.getByTestId('slot').contains(node as Node)).toBe(true);
    expect(props).toMatchObject({ hidePersonal: true });
  });

  it('does not warn about the children it renders', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clerk = createFakeClerk();
    renderWithClerk(clerk, () => (
      <UserButton __experimental_asProvider>
        <p>layout</p>
        <UserButton.__experimental_Outlet />
      </UserButton>
    ));
    expect(error).not.toHaveBeenCalled();
    expect(screen.getByText('layout')).toBeTruthy();
  });

  it.each([
    [
      'UserButton',
      () => (
        <UserButton>
          <UserButton.__experimental_Outlet />
        </UserButton>
      ),
      'mountUserButton'
    ],
    [
      'OrganizationSwitcher',
      () => (
        <OrganizationSwitcher>
          <OrganizationSwitcher.__experimental_Outlet />
        </OrganizationSwitcher>
      ),
      'mountOrganizationSwitcher'
    ]
  ] as const)(
    'renders nothing, with a warning, for an Outlet in a %s that is not a provider',
    (_name, ui, mount) => {
      vi.stubEnv('NODE_ENV', 'development');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const clerk = createFakeClerk();
      renderWithClerk(clerk, ui);
      // The component itself, and no second one for the Outlet.
      expect(clerk[mount]).toHaveBeenCalledTimes(1);
      expect(error.mock.calls.flat().join(' ')).toContain(
        '__experimental_Outlet'
      );
    }
  );

  it('renders nothing, with a warning, for an Outlet outside a provider', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clerk = createFakeClerk();
    renderWithClerk(clerk, () => <UserButton.__experimental_Outlet />);
    expect(clerk.mountUserButton).not.toHaveBeenCalled();
    expect(error.mock.calls.flat().join(' ')).toContain(
      '__experimental_Outlet'
    );
  });
});

describe('UserProfileModal', () => {
  it('still warns in development about a page with missing props', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clerk = {
      ...createFakeClerk(),
      openUserProfile: vi.fn(),
      closeUserProfile: vi.fn()
    };
    renderWithClerk(clerk as any, () => (
      <UserProfileModal>
        <UserProfileModal.Page
          {...({ label: 'No url', labelIcon: <svg /> } as any)}
        >
          <p>body</p>
        </UserProfileModal.Page>
      </UserProfileModal>
    ));
    expect(error.mock.calls.flat().join(' ')).toContain('UserProfile');
  });
});

describe('custom element portals', () => {
  it('forgets the handlers of an element that is gone', () => {
    createRoot((dispose) => {
      const portals = createCustomElementPortals();
      const [ids, setIds] = createSignal(['a', 'b']);
      const first = portals.handlersFor('b');
      render(() => (
        <portals.CustomElements
          elements={ids().map((id) => ({ id, render: () => null }))}
        />
      ));
      expect(portals.handlersFor('b')).toBe(first);
      // Clerk shows b, then the app drops it and Clerk hides it, through
      // the handler it already holds.
      first.mount(document.createElement('div'));
      expect(portals.hasMountedNode()).toBe(true);
      setIds(['a']);
      expect(portals.handlersFor('b')).not.toBe(first);
      first.unmount();
      expect(portals.hasMountedNode()).toBe(false);
      dispose();
    });
  });

  it("leaves a re-added element's node alone when the old handler unmounts late", () => {
    // No createRoot: inside one, Solid runs the portals' effects only once it
    // returns.
    const portals = createCustomElementPortals();
    const [ids, setIds] = createSignal(['b']);
    render(() => (
      <portals.CustomElements
        elements={ids().map((id) => ({ id, render: () => <p>body {id}</p> }))}
      />
    ));
    const first = portals.handlersFor('b');
    first.mount(document.createElement('div'));
    // The item leaves and comes back before Clerk unmounts the old one.
    setIds([]);
    setIds(['b']);
    const second = portals.handlersFor('b');
    expect(second).not.toBe(first);
    // Clerk's nodes are in the document.
    const node = document.body.appendChild(document.createElement('div'));
    second.mount(node);
    first.unmount();
    expect(portals.hasMountedNode()).toBe(true);
    expect(node.textContent).toContain('body b');
    second.unmount();
    expect(portals.hasMountedNode()).toBe(false);
    node.remove();
  });
});

describe('MultisessionAppSupport', () => {
  it('renders its children again when the session changes', async () => {
    const { clerkJS, emit } = createFakeClerkJS(signedInAs('user_1'));
    const mounts: string[] = [];
    const disposals: string[] = [];
    const Child = () => {
      const id = Math.random().toString(36).slice(2);
      mounts.push(id);
      onCleanup(() => disposals.push(id));
      return <p>child</p>;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <MultisessionAppSupport>
          <Child />
        </MultisessionAppSupport>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));
    const before = mounts.length;

    emit(signedInAs('user_2'));
    await vi.waitFor(() => expect(mounts.length).toBe(before + 1));
    // Every earlier render is gone; only the newest is on the page.
    expect(disposals).toEqual(mounts.slice(0, -1));
    expect(screen.getAllByText('child')).toHaveLength(1);
  });
});

describe('MultisessionAppSupport within one session', () => {
  it('keeps reactive children reactive', async () => {
    const { clerkJS } = createFakeClerkJS(signedInAs('user_1'));
    const [message, setMessage] = createSignal('first');
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <p data-testid="message">
          <MultisessionAppSupport>{message()}</MultisessionAppSupport>
        </p>
      </ClerkProvider>
    ));
    await vi.waitFor(() => expect(clerkJS.loaded).toBe(true));
    expect(screen.getByTestId('message').textContent).toBe('first');
    setMessage('second');
    expect(screen.getByTestId('message').textContent).toBe('second');
  });
});

describe('useDerivedAuth', () => {
  it("derives useAuth's state from an auth object, with has() from its claims", () => {
    const [object, setObject] = createSignal<any>({
      sessionId: 'sess_1',
      sessionStatus: 'active',
      userId: 'user_1',
      orgId: 'org_1',
      orgRole: 'org:admin',
      orgPermissions: ['org:sys_memberships:manage'],
      sessionClaims: { pla: 'u:pro' }
    });
    createRoot((dispose) => {
      const auth = useDerivedAuth(object);
      expect(auth()).toMatchObject({
        isLoaded: true,
        isSignedIn: true,
        userId: 'user_1',
        orgId: 'org_1'
      });
      expect(auth().has({ permission: 'org:sys_memberships:manage' })).toBe(
        true
      );
      expect(auth().has({ plan: 'pro' })).toBe(true);

      // A pending session counts as signed out by default.
      setObject({ ...object(), sessionStatus: 'pending' });
      expect(auth().isSignedIn).toBe(false);
      dispose();
    });
  });
});

describe('useRoutingProps', () => {
  it('defaults to path routing, which needs a path', () => {
    expect(useRoutingProps('SignIn', { path: '/sign-in' })).toMatchObject({
      routing: 'path',
      path: '/sign-in'
    });
    expect(
      useRoutingProps('SignIn', {}, { path: '/from-the-framework' })
    ).toMatchObject({ routing: 'path', path: '/from-the-framework' });
    expect(() => useRoutingProps('SignIn', {})).toThrow(/path/);
  });

  it('drops the path for other routing, and rejects one passed with it', () => {
    expect(useRoutingProps('SignIn', { routing: 'hash' })).toMatchObject({
      routing: 'hash',
      path: undefined
    });
    // A framework's default path does not survive the app's hash routing.
    const hashed = useRoutingProps(
      'SignIn',
      { routing: 'hash' },
      { path: '/sign-in' }
    );
    expect(hashed.routing).toBe('hash');
    expect((hashed as { path?: string }).path).toBeUndefined();
    expect(() =>
      // RoutingOptions rejects this combination at compile time too.
      useRoutingProps('SignIn', { routing: 'hash', path: '/sign-in' } as any)
    ).toThrow();
  });
});
