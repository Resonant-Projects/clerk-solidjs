import type {
  CreateOrganizationProps,
  GoogleOneTapProps,
  OrganizationListProps,
  OrganizationProfileProps,
  OrganizationSwitcherProps,
  SignInProps,
  SignUpProps,
  UserButtonProps,
  UserProfileModalProps,
  UserProfileProps,
  WaitlistProps,
  Without
} from '@clerk/shared/types';
import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  onMount,
  ParentProps,
  Show,
  splitProps,
  untrack
} from 'solid-js';
import { IsomorphicClerk } from '../isomorphic-clerk';
import type { MountProps, OpenProps, WithClerkProp } from '../types';
import { createCustomElementPortals } from '../utils/custom-element-portals';
import {
  buildCustomPages,
  buildUserButtonMenuItems,
  MenuAction,
  MenuItems,
  MenuLink,
  organizationProfileCustomPagesOptions,
  OrganizationProfileLink,
  OrganizationProfilePage,
  resolveCustomChildren,
  userButtonCustomPagesOptions,
  userProfileCustomPagesOptions,
  UserProfileLink,
  UserProfilePage
} from '../utils/custom-pages';
import { withClerk } from './with-clerk';

type UserProfileExportType = typeof _UserProfile & {
  Page: typeof UserProfilePage;
  Link: typeof UserProfileLink;
};

type UserProfileModalExportType = typeof _UserProfileModal & {
  Page: typeof UserProfilePage;
  Link: typeof UserProfileLink;
};

type UserButtonExportType = typeof _UserButton & {
  UserProfilePage: typeof UserProfilePage;
  UserProfileLink: typeof UserProfileLink;
  MenuItems: typeof MenuItems;
  Action: typeof MenuAction;
  Link: typeof MenuLink;
};

type UserButtonPropsWithoutCustomPages = Without<
  UserButtonProps,
  'userProfileProps'
> & {
  userProfileProps?: Pick<
    UserProfileProps,
    'additionalOAuthScopes' | 'appearance'
  >;
};

type OrganizationProfileExportType = typeof _OrganizationProfile & {
  Page: typeof OrganizationProfilePage;
  Link: typeof OrganizationProfileLink;
};

type OrganizationSwitcherExportType = typeof _OrganizationSwitcher & {
  OrganizationProfilePage: typeof OrganizationProfilePage;
  OrganizationProfileLink: typeof OrganizationProfileLink;
};

type OrganizationSwitcherPropsWithoutCustomPages = Without<
  OrganizationSwitcherProps,
  'organizationProfileProps'
> & {
  organizationProfileProps?: Pick<OrganizationProfileProps, 'appearance'>;
};

type FallbackProp = {
  /** Rendered until the Clerk component has rendered, including on the server. */
  fallback?: JSX.Element;
};

const isMountProps = (props: any): props is MountProps => {
  return 'mount' in props;
};

const isOpenProps = (props: any): props is OpenProps => {
  return 'open' in props;
};

/**
 * Calls `onReady` once Clerk has rendered into `node`: once it has children,
 * or an element matching `selector`.
 */
const watchRendered = (
  node: HTMLDivElement,
  selector: string | undefined,
  onReady: () => void
) => {
  const isReady = () =>
    selector ? !!node.querySelector(selector) : node.childElementCount > 0;
  if (isReady()) {
    onReady();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!isReady()) return;
    observer.disconnect();
    onReady();
  });
  observer.observe(node, {
    childList: true,
    subtree: true,
    attributes: !!selector
  });
  onCleanup(() => observer.disconnect());
};

type HostProps = (MountProps | OpenProps) & {
  /** Set as `data-clerk-component` on the host element. */
  component: string;
  fallback?: JSX.Element;
  /** An element inside the host that means Clerk has rendered. */
  readySelector?: string;
};

/**
 * The element a Clerk component mounts into. It renders on the server and
 * before clerk-js loads; IsomorphicClerk queues the mount until clerk-js is
 * ready. `fallback` shows until Clerk has rendered.
 */
const Portal: Component<HostProps> = (props) => {
  let node: HTMLDivElement | undefined;
  let mounted = false;
  const [rendered, setRendered] = createSignal(false);

  // Spreading reads every key, so this re-runs when any prop changes, whether
  // the caller passes a splitProps proxy or an object literal. Clerk keeps the
  // object it is given, so it gets a plain copy rather than a live Solid proxy.
  const snapshot = createMemo(() => ({ ...props.props }));

  onMount(() => {
    if (!node) return;
    if (isMountProps(props)) {
      props.mount(node, untrack(snapshot));
      watchRendered(
        node,
        untrack(() => props.readySelector),
        () => setRendered(true)
      );
    } else if (isOpenProps(props)) {
      props.open(untrack(snapshot));
    }
    mounted = true;
  });

  createEffect(
    on(
      snapshot,
      (current) => {
        if (mounted && node && isMountProps(props)) {
          void props.updateProps({ node, props: current });
        }
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    if (!mounted || !node) return;
    if (isMountProps(props)) {
      props.unmount(node);
    } else if (isOpenProps(props)) {
      props.close();
    }
  });

  return (
    <>
      <Show when={!rendered()}>{props.fallback}</Show>
      <div
        ref={(el) => {
          node = el;
        }}
        data-clerk-component={props.component}
      />
    </>
  );
};

export const SignIn = withClerk(
  (props: WithClerkProp<SignInProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="SignIn"
        fallback={local.fallback}
        mount={local.clerk().mountSignIn}
        unmount={local.clerk().unmountSignIn}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'SignIn', renderWhileLoading: true }
);

export const Waitlist = withClerk(
  (props: WithClerkProp<WaitlistProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="Waitlist"
        fallback={local.fallback}
        mount={local.clerk().mountWaitlist}
        unmount={local.clerk().unmountWaitlist}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'Waitlist', renderWhileLoading: true }
);

export const SignUp = withClerk(
  (props: WithClerkProp<SignUpProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="SignUp"
        fallback={local.fallback}
        mount={local.clerk().mountSignUp}
        unmount={local.clerk().unmountSignUp}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'SignUp', renderWhileLoading: true }
);

const _UserProfile = withClerk(
  (
    props: WithClerkProp<
      ParentProps<Without<UserProfileProps, 'customPages'>> & FallbackProp
    >
  ) => {
    const [local, clerkProps] = splitProps(props, [
      'clerk',
      'children',
      'fallback'
    ]);
    const portals = createCustomElementPortals();
    const entries = resolveCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        userProfileCustomPagesOptions,
        portals.handlersFor
      )
    );

    return (
      <>
        <Portal
          component="UserProfile"
          fallback={local.fallback}
          mount={local.clerk().mountUserProfile}
          unmount={local.clerk().unmountUserProfile}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
          }
          props={{ ...clerkProps, customPages: pages().customPages }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  { component: 'UserProfile', renderWhileLoading: true }
);

export const UserProfile: UserProfileExportType = Object.assign(_UserProfile, {
  Page: UserProfilePage,
  Link: UserProfileLink
});

const _UserButton = withClerk(
  (
    props: WithClerkProp<
      ParentProps<UserButtonPropsWithoutCustomPages> & FallbackProp
    >
  ) => {
    const [local, clerkProps] = splitProps(props, [
      'clerk',
      'children',
      'fallback'
    ]);
    const portals = createCustomElementPortals();
    const entries = resolveCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        userButtonCustomPagesOptions,
        portals.handlersFor
      )
    );
    const menu = createMemo(() =>
      buildUserButtonMenuItems(entries(), portals.handlersFor)
    );

    return (
      <>
        <Portal
          component="UserButton"
          fallback={local.fallback}
          mount={local.clerk().mountUserButton}
          unmount={local.clerk().unmountUserButton}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
          }
          props={{
            ...clerkProps,
            userProfileProps: {
              ...clerkProps.userProfileProps,
              customPages: pages().customPages
            },
            customMenuItems: menu().customMenuItems
          }}
        />
        <portals.CustomElements
          elements={[...pages().elements, ...menu().elements]}
        />
      </>
    );
  },
  { component: 'UserButton', renderWhileLoading: true }
);

export const UserButton: UserButtonExportType = Object.assign(_UserButton, {
  UserProfilePage,
  UserProfileLink,
  MenuItems,
  Action: MenuAction,
  Link: MenuLink
});

const _OrganizationProfile = withClerk(
  (
    props: WithClerkProp<
      ParentProps<Without<OrganizationProfileProps, 'customPages'>> &
        FallbackProp
    >
  ) => {
    const [local, clerkProps] = splitProps(props, [
      'clerk',
      'children',
      'fallback'
    ]);
    const portals = createCustomElementPortals();
    const entries = resolveCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        organizationProfileCustomPagesOptions,
        portals.handlersFor
      )
    );

    return (
      <>
        <Portal
          component="OrganizationProfile"
          fallback={local.fallback}
          mount={local.clerk().mountOrganizationProfile}
          unmount={local.clerk().unmountOrganizationProfile}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
          }
          props={{ ...clerkProps, customPages: pages().customPages }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  { component: 'OrganizationProfile', renderWhileLoading: true }
);

export const OrganizationProfile: OrganizationProfileExportType = Object.assign(
  _OrganizationProfile,
  {
    Page: OrganizationProfilePage,
    Link: OrganizationProfileLink
  }
);

export const CreateOrganization = withClerk(
  (props: WithClerkProp<CreateOrganizationProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="CreateOrganization"
        fallback={local.fallback}
        mount={local.clerk().mountCreateOrganization}
        unmount={local.clerk().unmountCreateOrganization}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'CreateOrganization', renderWhileLoading: true }
);

const _OrganizationSwitcher = withClerk(
  (
    props: WithClerkProp<
      ParentProps<OrganizationSwitcherPropsWithoutCustomPages> & FallbackProp
    >
  ) => {
    const [local, clerkProps] = splitProps(props, [
      'clerk',
      'children',
      'fallback'
    ]);
    const portals = createCustomElementPortals();
    const entries = resolveCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        organizationProfileCustomPagesOptions,
        portals.handlersFor
      )
    );

    return (
      <>
        <Portal
          component="OrganizationSwitcher"
          fallback={local.fallback}
          mount={local.clerk().mountOrganizationSwitcher}
          unmount={local.clerk().unmountOrganizationSwitcher}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
          }
          props={{
            ...clerkProps,
            organizationProfileProps: {
              ...clerkProps.organizationProfileProps,
              customPages: pages().customPages
            }
          }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  { component: 'OrganizationSwitcher', renderWhileLoading: true }
);

export const OrganizationSwitcher: OrganizationSwitcherExportType =
  Object.assign(_OrganizationSwitcher, {
    OrganizationProfilePage,
    OrganizationProfileLink
  });

export const OrganizationList = withClerk(
  (props: WithClerkProp<OrganizationListProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="OrganizationList"
        fallback={local.fallback}
        mount={local.clerk().mountOrganizationList}
        unmount={local.clerk().unmountOrganizationList}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'OrganizationList', renderWhileLoading: true }
);

/** Clerk's profile modal is open; `cl-` classes are Clerk's stable appearance hooks. */
const isUserProfileModalOpen = () =>
  typeof document !== 'undefined' &&
  document.querySelector('.cl-modalContent .cl-userProfile-root') !== null;

const _UserProfileModal = withClerk(
  (
    props: WithClerkProp<
      ParentProps<Without<UserProfileModalProps, 'customPages'>>
    >
  ) => {
    const [local, clerkProps] = splitProps(props, ['clerk', 'children']);
    const [, updateProps] = splitProps(clerkProps, [
      '__experimental_startPath'
    ]);
    const portals = createCustomElementPortals();
    const entries = resolveCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        userProfileCustomPagesOptions,
        portals.handlersFor
      )
    );

    // Clerk reads customPages when the modal opens. While it stays open, calling openUserProfile again updates its
    // pages in place and keeps the user on their current page, as long as no start path is passed. Skip the update
    // once the modal is closed, or it would reopen. Clerk reports no open state, so a mounted custom element or
    // Clerk's profile modal in the DOM (when no custom element is showing) counts as open.
    createEffect(
      on(
        () => pages().customPages,
        (customPages) => {
          if (!untrack(portals.hasMountedNode) && !isUserProfileModalOpen())
            return;
          local.clerk().openUserProfile({ ...updateProps, customPages });
        },
        { defer: true }
      )
    );

    return (
      <>
        <Portal
          component="UserProfileModal"
          open={local.clerk().openUserProfile}
          close={local.clerk().closeUserProfile}
          props={{ ...clerkProps, customPages: pages().customPages }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  'UserProfileModal'
);

/**
 * Opens Clerk's user profile modal while mounted and closes it on unmount.
 * Takes the same `UserProfile.Page` / `UserProfile.Link` children as
 * `<UserProfile />`, so an app can open the modal on one of its own pages,
 * for example with `__experimental_startPath="/notifications"`. Page changes
 * reach the open modal without moving the user; remount the component to open
 * the modal again after the user closed it.
 */
export const UserProfileModal: UserProfileModalExportType = Object.assign(
  _UserProfileModal,
  {
    Page: UserProfilePage,
    Link: UserProfileLink
  }
);

export const GoogleOneTap = withClerk(
  (props: WithClerkProp<GoogleOneTapProps>) => {
    const [local, rest] = splitProps(props, ['clerk']);
    return (
      <Portal
        component="GoogleOneTap"
        open={local.clerk().openGoogleOneTap}
        close={local.clerk().closeGoogleOneTap}
        props={rest}
      />
    );
  },
  // Opening before clerk-js loads queues in IsomorphicClerk.
  { component: 'GoogleOneTap', renderWhileLoading: true }
);
