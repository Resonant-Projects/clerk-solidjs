import type { CustomMenuItem, CustomPage } from '@clerk/shared/types';
import { render } from '@solidjs/testing-library';
import {
  createContext,
  createSignal,
  For,
  type JSX,
  Show,
  useContext
} from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrganizationSwitcher,
  UserButton,
  UserProfile,
  UserProfileModal
} from '..';
import { ClerkInstanceContextProvider } from '../../contexts/clerk-instance';

const createFakeClerk = () => ({
  loaded: true,
  mountUserButton: vi.fn(),
  unmountUserButton: vi.fn(),
  mountUserProfile: vi.fn(),
  unmountUserProfile: vi.fn(),
  mountOrganizationSwitcher: vi.fn(),
  unmountOrganizationSwitcher: vi.fn(),
  openUserProfile: vi.fn(),
  closeUserProfile: vi.fn(),
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
    expect(
      messages.some((m) =>
        m.includes('either an onClick function or an open string')
      )
    ).toBe(true);
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

  it('treats an undefined spread icon as absent for reorder items', () => {
    const clerk = createFakeClerk();
    const [page] = createSignal({
      label: 'account' as const,
      labelIcon: undefined,
      children: undefined
    });
    const [action] = createSignal({
      label: 'signOut' as const,
      labelIcon: undefined
    });

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action {...action()} />
        </UserButton.MenuItems>
        <UserButton.UserProfilePage {...page()} />
      </UserButton>
    ));

    const props = latestProps(clerk, 'mountUserButton');
    expect(props.userProfileProps.customPages).toEqual([{ label: 'account' }]);
    expect(props.customMenuItems).toEqual([{ label: 'signOut' }]);
  });

  it('adds an item once its reactive icon becomes available', () => {
    const clerk = createFakeClerk();
    const [icon, setIcon] = createSignal<JSX.Element>();

    renderWithClerk(clerk, () => (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action
            label="Help"
            labelIcon={icon()}
            onClick={() => {}}
          />
        </UserButton.MenuItems>
      </UserButton>
    ));

    expect(latestProps(clerk, 'mountUserButton').customMenuItems).toEqual([]);
    setIcon(<Icon name="help" />);
    const items = latestProps(clerk, 'mountUserButton')
      .customMenuItems as CustomMenuItem[];
    expect(items.map((item) => item.label)).toEqual(['Help']);
  });

  it('builds each icon once and reuses it for validation and rendering', () => {
    const clerk = createFakeClerk();
    const [siblingLabel, setSiblingLabel] = createSignal('Second');
    let instances = 0;
    const CountingIcon = () => {
      instances++;
      return <svg data-testid="counting-icon" />;
    };

    renderWithClerk(clerk, () => (
      <UserProfile>
        <UserProfile.Page
          label="First"
          url="first"
          labelIcon={<CountingIcon />}
        >
          <p>First</p>
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
    first!.mountIcon!(node as HTMLDivElement);
    expect(node.querySelector('[data-testid="counting-icon"]')).not.toBeNull();

    setSiblingLabel('Renamed');
    expect(instances).toBe(1);
    node.remove();
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

  it('shows the new body when a page token is replaced under the same id', () => {
    const clerk = createFakeClerk();
    const [pages, setPages] = createSignal([{ body: 'old body' }]);

    renderWithClerk(clerk, () => (
      <UserProfile>
        <For each={pages()}>
          {(page) => (
            <UserProfile.Page
              label="Notes"
              url="notes"
              labelIcon={<Icon name="notes" />}
            >
              <p>{page.body}</p>
            </UserProfile.Page>
          )}
        </For>
      </UserProfile>
    ));

    const [page] = latestProps(clerk, 'mountUserProfile')
      .customPages as CustomPage[];
    const node = document.createElement('div');
    document.body.appendChild(node);
    page!.mount!(node as HTMLDivElement);
    expect(node.textContent).toBe('old body');

    setPages([{ body: 'new body' }]);
    expect(node.textContent).toBe('new body');
    node.remove();
  });
});

describe('<UserProfileModal />', () => {
  it('opens the profile modal on a custom page and closes it on unmount', () => {
    const clerk = createFakeClerk();
    const [open, setOpen] = createSignal(true);

    renderWithClerk(clerk, () => (
      <Show when={open()}>
        <UserProfileModal __experimental_startPath="/notifications">
          <UserProfileModal.Page
            label="Notifications"
            url="notifications"
            labelIcon={<Icon name="bell" />}
          >
            <p data-testid="modal-page">Notification settings</p>
          </UserProfileModal.Page>
        </UserProfileModal>
      </Show>
    ));

    expect(clerk.openUserProfile).toHaveBeenCalledOnce();
    const props = clerk.openUserProfile.mock.calls[0]![0];
    expect(props.__experimental_startPath).toBe('/notifications');
    expect(props).not.toHaveProperty('children');
    const [page] = props.customPages as CustomPage[];
    expect(page!.label).toBe('Notifications');

    const node = document.createElement('div');
    document.body.appendChild(node);
    page!.mount!(node as HTMLDivElement);
    expect(node.querySelector('[data-testid="modal-page"]')).not.toBeNull();

    setOpen(false);
    expect(clerk.closeUserProfile).toHaveBeenCalledOnce();
    node.remove();
  });

  it('sends page changes to the open modal without moving the user', () => {
    const clerk = createFakeClerk();
    const [label, setLabel] = createSignal('Notifications');

    renderWithClerk(clerk, () => (
      <UserProfileModal __experimental_startPath="/notifications">
        <UserProfileModal.Page
          label={label()}
          url="notifications"
          labelIcon={<Icon name="bell" />}
        >
          <p data-testid="live-page">Notification settings</p>
        </UserProfileModal.Page>
      </UserProfileModal>
    ));

    // Clerk shows the sidebar icon while the modal is open.
    const [opened] = clerk.openUserProfile.mock.calls[0]![0]
      .customPages as CustomPage[];
    const iconNode = document.createElement('div');
    document.body.appendChild(iconNode);
    opened!.mountIcon!(iconNode as HTMLDivElement);

    setLabel('Alerts');
    expect(clerk.openUserProfile).toHaveBeenCalledTimes(2);
    const update = clerk.openUserProfile.mock.calls[1]![0];
    expect(update).not.toHaveProperty('__experimental_startPath');
    const [renamed] = update.customPages as CustomPage[];
    expect(renamed!.label).toBe('Alerts');

    const pageNode = document.createElement('div');
    document.body.appendChild(pageNode);
    renamed!.mount!(pageNode as HTMLDivElement);
    expect(pageNode.querySelector('[data-testid="live-page"]')).not.toBeNull();
    iconNode.remove();
    pageNode.remove();
  });

  it('does not reopen a closed modal when its pages change', () => {
    const clerk = createFakeClerk();
    const [label, setLabel] = createSignal('Notifications');

    renderWithClerk(clerk, () => (
      <UserProfileModal>
        <UserProfileModal.Page
          label={label()}
          url="notifications"
          labelIcon={<Icon name="bell" />}
        >
          <p>Notification settings</p>
        </UserProfileModal.Page>
      </UserProfileModal>
    ));

    // No icon is mounted: the user closed the modal (or Clerk has not shown it).
    setLabel('Alerts');
    expect(clerk.openUserProfile).toHaveBeenCalledOnce();
  });

  it('drops a conditional page from the open modal without touching its stale scope', () => {
    const clerk = createFakeClerk();
    const [selected, setSelected] = createSignal<{ text: string }>();
    setSelected({ text: 'Selected body' });

    renderWithClerk(clerk, () => (
      <UserProfileModal>
        <Show when={selected()}>
          {(item) => (
            <UserProfileModal.Page
              label="Selected"
              url="selected"
              labelIcon={<Icon name="sel" />}
            >
              <p data-testid="selected-body">{item().text}</p>
            </UserProfileModal.Page>
          )}
        </Show>
      </UserProfileModal>
    ));

    const [page] = clerk.openUserProfile.mock.calls[0]![0]
      .customPages as CustomPage[];
    const iconNode = document.createElement('div');
    const pageNode = document.createElement('div');
    document.body.append(iconNode, pageNode);
    page!.mountIcon!(iconNode as HTMLDivElement);
    page!.mount!(pageNode as HTMLDivElement);
    expect(pageNode.textContent).toBe('Selected body');

    expect(() => setSelected(undefined)).not.toThrow();
    expect(pageNode.querySelector('[data-testid="selected-body"]')).toBeNull();
    expect(clerk.openUserProfile.mock.calls[1]![0].customPages).toEqual([]);
    iconNode.remove();
    pageNode.remove();
  });

  it('sends a first custom page to an open modal that had none', () => {
    const clerk = createFakeClerk();
    const [show, setShow] = createSignal(false);
    // Clerk's open profile modal, with no custom page icons mounted yet.
    const clerkModal = document.createElement('div');
    clerkModal.className = 'cl-modalContent';
    clerkModal.innerHTML = '<div class="cl-userProfile-root"></div>';
    document.body.appendChild(clerkModal);

    renderWithClerk(clerk, () => (
      <UserProfileModal>
        <Show when={show()}>
          <UserProfileModal.Page
            label="Added"
            url="added"
            labelIcon={<Icon name="added" />}
          >
            <p>Added</p>
          </UserProfileModal.Page>
        </Show>
      </UserProfileModal>
    ));

    setShow(true);
    expect(clerk.openUserProfile).toHaveBeenCalledTimes(2);
    expect(
      (clerk.openUserProfile.mock.calls[1]![0].customPages as CustomPage[]).map(
        (page) => page.label
      )
    ).toEqual(['Added']);
    clerkModal.remove();
  });
});
