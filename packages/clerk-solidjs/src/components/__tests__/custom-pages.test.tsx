import type { CustomMenuItem, CustomPage } from '@clerk/shared/types';
import { render } from '@solidjs/testing-library';
import { createContext, createSignal, type JSX, useContext } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSwitcher, UserButton, UserProfile } from '..';
import { ClerkInstanceContextProvider } from '../../contexts/clerk-instance';

const createFakeClerk = () => ({
  loaded: true,
  mountUserButton: vi.fn(),
  unmountUserButton: vi.fn(),
  mountUserProfile: vi.fn(),
  unmountUserProfile: vi.fn(),
  mountOrganizationSwitcher: vi.fn(),
  unmountOrganizationSwitcher: vi.fn(),
  __unstable__updateProps: vi.fn()
});

type FakeClerk = ReturnType<typeof createFakeClerk>;

const renderWithClerk = (clerk: FakeClerk, ui: () => JSX.Element) =>
  render(() => (
    <ClerkInstanceContextProvider clerk={() => clerk as any}>
      {ui()}
    </ClerkInstanceContextProvider>
  ));

/** Props from the latest mount or updateProps call. */
const latestProps = (clerk: FakeClerk, mount: keyof FakeClerk) => {
  const updates = clerk.__unstable__updateProps.mock.calls;
  if (updates.length) {
    return updates[updates.length - 1]![0].props;
  }
  return (clerk[mount] as any).mock.calls[0][1];
};

const Icon = (props: { name: string }) => (
  <svg data-testid={`icon-${props.name}`} />
);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('<UserButton.MenuItems />', () => {
  it('passes actions, links and reorder items to Clerk as customMenuItems', () => {
    const clerk = createFakeClerk();
    const onClick = vi.fn();

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action
            label="Help"
            labelIcon={<Icon name="help" />}
            onClick={onClick}
          />
          <UserButton.Action
            label="Profile"
            labelIcon={<Icon name="profile" />}
            open="profile"
          />
          <UserButton.Link
            label="Docs"
            labelIcon={<Icon name="docs" />}
            href="/docs"
          />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      </UserButton>
    ));

    const items = latestProps(clerk, 'mountUserButton')
      .customMenuItems as CustomMenuItem[];
    expect(items.map((item) => item.label)).toEqual([
      'Help',
      'Profile',
      'Docs',
      'signOut'
    ]);
    expect(items[0]!.onClick).toBe(onClick);
    expect(items[1]!.open).toBe('/profile');
    expect(items[2]!.href).toBe('/docs');
    expect(items[3]).toEqual({ label: 'signOut' });
    expect(typeof items[0]!.mountIcon).toBe('function');
  });

  it('renders an icon into the node Clerk provides, with app context', () => {
    const clerk = createFakeClerk();
    const Theme = createContext('none');
    const ThemedIcon = () => (
      <span data-testid="themed-icon">{useContext(Theme)}</span>
    );

    renderWithClerk(clerk, () => (
      <Theme.Provider value="dark">
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Action
              label="Help"
              labelIcon={<ThemedIcon />}
              onClick={() => {}}
            />
          </UserButton.MenuItems>
        </UserButton>
      </Theme.Provider>
    ));

    const [item] = latestProps(clerk, 'mountUserButton')
      .customMenuItems as CustomMenuItem[];
    const node = document.createElement('div');
    document.body.appendChild(node);

    item!.mountIcon!(node);
    expect(node.querySelector('[data-testid="themed-icon"]')?.textContent).toBe(
      'dark'
    );

    item!.unmountIcon!(node);
    expect(node.querySelector('[data-testid="themed-icon"]')).toBeNull();
    node.remove();
  });

  it('updates Clerk when a menu item label changes', () => {
    const clerk = createFakeClerk();
    const [label, setLabel] = createSignal('Help');

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action
            label={label()}
            labelIcon={<Icon name="help" />}
            onClick={() => {}}
          />
        </UserButton.MenuItems>
      </UserButton>
    ));

    const before = latestProps(clerk, 'mountUserButton')
      .customMenuItems as CustomMenuItem[];
    setLabel('Support');
    const after = latestProps(clerk, 'mountUserButton')
      .customMenuItems as CustomMenuItem[];

    expect(after[0]!.label).toBe('Support');
    expect(before[0]!.label).toBe('Help');
  });

  it('does not pass children through to Clerk', () => {
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action label="manageAccount" />
        </UserButton.MenuItems>
      </UserButton>
    ));

    expect(latestProps(clerk, 'mountUserButton')).not.toHaveProperty(
      'children'
    );
  });

  it('logs in development when an action has no target', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          {/* @ts-expect-error a custom action needs onClick or open */}
          <UserButton.Action label="Help" labelIcon={<Icon name="help" />} />
          <div>not a menu item</div>
        </UserButton.MenuItems>
      </UserButton>
    ));

    const messages = consoleError.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes('either onClick or open'))).toBe(
      true
    );
    expect(
      messages.some((m) => m.includes('can only accept <UserButton.Action />'))
    ).toBe(true);
    expect(latestProps(clerk, 'mountUserButton').customMenuItems).toEqual([]);
    consoleError.mockRestore();
  });

  it('logs in development when a menu item renders outside UserButton', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { container } = render(() => <UserButton.Action label="signOut" />);

    expect(container.innerHTML).toBe('');
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      'needs to be a direct child of `<UserButton.MenuItems />`'
    );
    consoleError.mockRestore();
  });
});

describe('custom profile pages', () => {
  it('maps UserButton.UserProfilePage to userProfileProps.customPages and renders its body', () => {
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <UserButton userProfileProps={{ appearance: {} }}>
        <UserButton.UserProfilePage
          label="Notifications"
          url="notifications"
          labelIcon={<Icon name="bell" />}
        >
          <p data-testid="page-body">Notification settings</p>
        </UserButton.UserProfilePage>
        <UserButton.UserProfilePage label="account" />
        <UserButton.UserProfileLink
          label="Home"
          url="/"
          labelIcon={<Icon name="home" />}
        />
      </UserButton>
    ));

    const props = latestProps(clerk, 'mountUserButton');
    const pages = props.userProfileProps.customPages as CustomPage[];
    expect(props.userProfileProps.appearance).toEqual({});
    expect(pages.map((page) => page.label)).toEqual([
      'Notifications',
      'account',
      'Home'
    ]);
    expect(pages[1]).toEqual({ label: 'account' });
    expect(pages[2]!.mount).toBeUndefined();

    const node = document.createElement('div');
    document.body.appendChild(node);
    pages[0]!.mount!(node as HTMLDivElement);
    expect(node.querySelector('[data-testid="page-body"]')?.textContent).toBe(
      'Notification settings'
    );
    pages[0]!.unmount!(node as HTMLDivElement);
    expect(node.querySelector('[data-testid="page-body"]')).toBeNull();
    node.remove();
  });

  it('maps UserProfile.Page to customPages', () => {
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <UserProfile>
        <UserProfile.Page label="security" />
        <UserProfile.Page
          label="Household"
          url="household"
          labelIcon={<Icon name="users" />}
        >
          <p>Household</p>
        </UserProfile.Page>
      </UserProfile>
    ));

    const pages = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    expect(pages.map((page) => page.label)).toEqual(['security', 'Household']);
  });

  it('maps OrganizationSwitcher.OrganizationProfilePage to organizationProfileProps.customPages', () => {
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <OrganizationSwitcher>
        <OrganizationSwitcher.OrganizationProfilePage label="members" />
      </OrganizationSwitcher>
    ));

    expect(
      latestProps(clerk, 'mountOrganizationSwitcher').organizationProfileProps
        .customPages
    ).toEqual([{ label: 'members' }]);
  });

  it('logs in development when a custom page misses props', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const clerk = createFakeClerk();

    renderWithClerk(clerk, () => (
      <UserProfile>
        {/* @ts-expect-error a custom page needs url and labelIcon */}
        <UserProfile.Page label="Broken">
          <p>Broken</p>
        </UserProfile.Page>
      </UserProfile>
    ));

    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      '<UserProfile.Page /> component requires the following props'
    );
    expect(latestProps(clerk, 'mountUserProfile').customPages).toEqual([]);
    consoleError.mockRestore();
  });
});

describe('custom pages edge cases', () => {
  it('accepts items whose props come from a reactive spread', () => {
    const clerk = createFakeClerk();
    const [link] = createSignal({
      label: 'Home',
      url: '/',
      labelIcon: <Icon name="home" />
    });
    const [reorder] = createSignal({ label: 'account' as const });

    renderWithClerk(clerk, () => (
      <UserProfile>
        <UserProfile.Link {...link()} />
        <UserProfile.Page {...reorder()} />
      </UserProfile>
    ));

    const pages = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    expect(pages.map((page) => page.label)).toEqual(['Home', 'account']);
    expect(pages[1]).toEqual({ label: 'account' });
  });

  it('keeps a mounted page body when a sibling page changes', () => {
    const clerk = createFakeClerk();
    const [siblingLabel, setSiblingLabel] = createSignal('Second');
    let mounts = 0;
    const Body = () => {
      mounts++;
      return <p data-testid="first-body">First</p>;
    };

    renderWithClerk(clerk, () => (
      <UserProfile>
        <UserProfile.Page
          label="First"
          url="first"
          labelIcon={<Icon name="one" />}
        >
          <Body />
        </UserProfile.Page>
        <UserProfile.Page
          label={siblingLabel()}
          url="second"
          labelIcon={<Icon name="two" />}
        >
          <p>Second</p>
        </UserProfile.Page>
      </UserProfile>
    ));

    const [first] = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    const node = document.createElement('div');
    document.body.appendChild(node);
    first!.mount!(node as HTMLDivElement);
    expect(mounts).toBe(1);

    setSiblingLabel('Renamed');
    const pages = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    expect(pages[1]!.label).toBe('Renamed');
    expect(pages[0]!.mount).toBe(first!.mount);
    expect(node.querySelector('[data-testid="first-body"]')).not.toBeNull();
    expect(mounts).toBe(1);
    node.remove();
  });

  it('keeps bare reactive text in a mounted page body reactive', () => {
    const clerk = createFakeClerk();
    const [message, setMessage] = createSignal('first');

    renderWithClerk(clerk, () => (
      <UserProfile>
        <UserProfile.Page
          label="Messages"
          url="messages"
          labelIcon={<Icon name="msg" />}
        >
          {message()}
        </UserProfile.Page>
      </UserProfile>
    ));

    const [page] = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    const node = document.createElement('div');
    document.body.appendChild(node);
    page!.mount!(node as HTMLDivElement);
    expect(node.textContent).toBe('first');

    setMessage('second');
    expect(node.textContent).toBe('second');
    node.remove();
  });
});
