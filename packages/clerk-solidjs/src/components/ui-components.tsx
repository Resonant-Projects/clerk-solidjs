import type {
  APIKeysProps,
  CreateOrganizationProps,
  GoogleOneTapProps,
  OAuthConsentProps,
  OAuthDeviceVerificationProps,
  OrganizationListProps,
  OrganizationProfileProps,
  OrganizationSwitcherProps,
  PricingTableProps,
  SignInProps,
  SignUpProps,
  TaskChooseOrganizationProps,
  TaskResetPasswordProps,
  TaskSetupMFAProps,
  UserAvatarProps,
  UserButtonProps,
  UserProfileModalProps,
  UserProfileProps,
  WaitlistProps,
  Without
} from '@clerk/shared/types';
import { logErrorInDevMode } from '@clerk/shared/utils';
import {
  Accessor,
  Component,
  createComputed,
  createContext,
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
  untrack,
  useContext
} from 'solid-js';
import { usePortalRoot } from '../contexts/portal';
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
  otherChildren,
  useBuildWarnings,
  useCustomChildren,
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
  /**
   * Renders the `<UserButton __experimental_asProvider>` it is inside, with
   * its configuration and custom pages, wherever the app puts it.
   *
   * @experimental This API is experimental and may change at any moment.
   */
  __experimental_Outlet: typeof UserButtonOutlet;
};

type UserButtonPropsWithoutCustomPages = Without<
  UserButtonProps,
  'userProfileProps'
> & {
  userProfileProps?: Pick<
    UserProfileProps,
    'additionalOAuthScopes' | 'appearance'
  >;
  /**
   * Renders the children instead of the button, which then renders where
   * `<UserButton.__experimental_Outlet />` is.
   *
   * @experimental This API is experimental and may change at any moment.
   */
  __experimental_asProvider?: boolean;
};

type OrganizationProfileExportType = typeof _OrganizationProfile & {
  Page: typeof OrganizationProfilePage;
  Link: typeof OrganizationProfileLink;
};

type OrganizationSwitcherExportType = typeof _OrganizationSwitcher & {
  OrganizationProfilePage: typeof OrganizationProfilePage;
  OrganizationProfileLink: typeof OrganizationProfileLink;
  /**
   * Renders the `<OrganizationSwitcher __experimental_asProvider>` it is
   * inside, with its configuration and custom pages.
   *
   * @experimental This API is experimental and may change at any moment.
   */
  __experimental_Outlet: typeof OrganizationSwitcherOutlet;
};

type OrganizationSwitcherPropsWithoutCustomPages = Without<
  OrganizationSwitcherProps,
  'organizationProfileProps'
> & {
  organizationProfileProps?: Pick<OrganizationProfileProps, 'appearance'>;
  /**
   * Renders the children instead of the switcher, which then renders where
   * `<OrganizationSwitcher.__experimental_Outlet />` is.
   *
   * @experimental This API is experimental and may change at any moment.
   */
  __experimental_asProvider?: boolean;
};

/**
 * What an `__experimental_asProvider` component hands its Outlet: how to
 * mount it, and its props, kept current.
 */
type OutletContextValue = Pick<
  MountProps,
  'mount' | 'unmount' | 'updateProps'
> & {
  props: Accessor<Record<string, unknown>>;
  /** The provider's `fallback`, shown where the Outlet is until Clerk renders. */
  fallback: () => JSX.Element;
  /**
   * Whether the component is a provider. It provides this context either
   * way, as its children resolve beneath it, so an Outlet checks.
   */
  asProvider: () => boolean;
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
  // clerk-js sets the ready marker on the node itself, as @clerk/react's
  // `[data-clerk-component=…][data-component-status="ready"]` expects.
  const isReady = () =>
    node.childElementCount > 0 && (!selector || node.matches(selector));
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
  /** A selector the host matches once Clerk has rendered into it. */
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

  // An UNSAFE_PortalProvider's container, unless the props name their own.
  const getContainer = usePortalRoot();
  // Spreading reads every key, so this re-runs when any prop changes, whether
  // the caller passes a splitProps proxy or an object literal. Clerk keeps the
  // object it is given, so it gets a plain copy rather than a live Solid proxy.
  const snapshot = createMemo(() => ({
    ...(getContainer && { getContainer }),
    ...props.props
  }));

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
    const entries = useCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        userProfileCustomPagesOptions,
        portals.handlersFor
      )
    );
    useBuildWarnings(() => pages().warnings);

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

const UserButtonContext = createContext<OutletContextValue>();

type UserButtonHostProps = WithClerkProp<
  ParentProps<UserButtonPropsWithoutCustomPages> & FallbackProp
> & { share: (props: Record<string, unknown>) => void };

/**
 * The button itself, inside its Outlet context, so an Outlet among the
 * children (resolved here) finds the context.
 */
const UserButtonHost = (props: UserButtonHostProps) => {
  const [local, clerkProps] = splitProps(props, [
    'clerk',
    'children',
    'fallback',
    'share',
    '__experimental_asProvider'
  ]);
  const portals = createCustomElementPortals();
  const entries = useCustomChildren(() => local.children);
  const pages = createMemo(() =>
    buildCustomPages(
      entries(),
      {
        ...userButtonCustomPagesOptions,
        allowForAnyChildren: !!local.__experimental_asProvider
      },
      portals.handlersFor
    )
  );
  const menu = createMemo(() =>
    buildUserButtonMenuItems(entries(), portals.handlersFor)
  );
  useBuildWarnings(() => [...pages().warnings, ...menu().warnings]);

  const mountProps = () => ({
    ...clerkProps,
    userProfileProps: {
      ...clerkProps.userProfileProps,
      customPages: pages().customPages
    },
    customMenuItems: menu().customMenuItems
  });
  // A signal, not the memos, is what an Outlet reads: it may be created
  // while the children above are still resolving.
  createComputed(() => local.share(mountProps()));

  return (
    <>
      <Show
        when={local.__experimental_asProvider}
        fallback={
          <Portal
            component="UserButton"
            fallback={local.fallback}
            mount={local.clerk().mountUserButton}
            unmount={local.clerk().unmountUserButton}
            updateProps={
              (local.clerk() as unknown as IsomorphicClerk)
                .__internal_updateProps
            }
            props={mountProps()}
          />
        }
      >
        {otherChildren(entries())}
      </Show>
      <portals.CustomElements
        elements={[...pages().elements, ...menu().elements]}
      />
    </>
  );
};

const _UserButton = withClerk(
  (
    props: WithClerkProp<
      ParentProps<UserButtonPropsWithoutCustomPages> & FallbackProp
    >
  ) => {
    const [shared, share] = createSignal<Record<string, unknown>>(
      {},
      { equals: false }
    );
    const isomorphicClerk = () => props.clerk() as unknown as IsomorphicClerk;
    return (
      <UserButtonContext.Provider
        value={{
          mount: (node, mountProps) =>
            isomorphicClerk().mountUserButton(node, mountProps),
          unmount: (node) => isomorphicClerk().unmountUserButton(node),
          updateProps: (update) =>
            isomorphicClerk().__internal_updateProps(update),
          props: shared,
          fallback: () => props.fallback,
          asProvider: () => !!props.__experimental_asProvider
        }}
      >
        <UserButtonHost {...props} share={share} />
      </UserButtonContext.Provider>
    );
  },
  { component: 'UserButton', renderWhileLoading: true }
);

/**
 * Where a `<UserButton __experimental_asProvider>` renders: with its props
 * and custom pages, plus the props passed here.
 *
 * @experimental This API is experimental and may change at any moment.
 */
export function UserButtonOutlet(
  outletProps: Without<UserButtonProps, 'userProfileProps'>
): JSX.Element {
  const parent = useContext(UserButtonContext);
  // Only an asProvider component renders here; any other renders itself.
  const context = () => (parent?.asProvider() ? parent : undefined);
  if (!untrack(context)) {
    logErrorInDevMode(
      '<UserButton.__experimental_Outlet /> renders only inside <UserButton __experimental_asProvider>.'
    );
  }
  return (
    <Show when={context()}>
      {(outlet) => (
        <Portal
          component="UserButton"
          fallback={outlet().fallback()}
          mount={outlet().mount}
          unmount={outlet().unmount}
          updateProps={outlet().updateProps}
          props={{ ...outlet().props(), ...outletProps }}
        />
      )}
    </Show>
  );
}

export const UserButton: UserButtonExportType = Object.assign(_UserButton, {
  UserProfilePage,
  UserProfileLink,
  MenuItems,
  Action: MenuAction,
  Link: MenuLink,
  __experimental_Outlet: UserButtonOutlet
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
    const entries = useCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        organizationProfileCustomPagesOptions,
        portals.handlersFor
      )
    );
    useBuildWarnings(() => pages().warnings);

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

const OrganizationSwitcherContext = createContext<OutletContextValue>();

type OrganizationSwitcherHostProps = WithClerkProp<
  ParentProps<OrganizationSwitcherPropsWithoutCustomPages> & FallbackProp
> & { share: (props: Record<string, unknown>) => void };

/** The switcher itself, inside its Outlet context, as `UserButtonHost`. */
const OrganizationSwitcherHost = (props: OrganizationSwitcherHostProps) => {
  const [local, clerkProps] = splitProps(props, [
    'clerk',
    'children',
    'fallback',
    'share',
    '__experimental_asProvider'
  ]);
  const portals = createCustomElementPortals();
  const entries = useCustomChildren(() => local.children);
  const pages = createMemo(() =>
    buildCustomPages(
      entries(),
      {
        ...organizationProfileCustomPagesOptions,
        allowForAnyChildren: !!local.__experimental_asProvider
      },
      portals.handlersFor
    )
  );
  useBuildWarnings(() => pages().warnings);

  const mountProps = () => ({
    ...clerkProps,
    organizationProfileProps: {
      ...clerkProps.organizationProfileProps,
      customPages: pages().customPages
    }
  });
  createComputed(() => local.share(mountProps()));

  return (
    <>
      <Show
        when={local.__experimental_asProvider}
        fallback={
          <Portal
            component="OrganizationSwitcher"
            fallback={local.fallback}
            mount={local.clerk().mountOrganizationSwitcher}
            unmount={local.clerk().unmountOrganizationSwitcher}
            updateProps={
              (local.clerk() as unknown as IsomorphicClerk)
                .__internal_updateProps
            }
            props={mountProps()}
          />
        }
      >
        {otherChildren(entries())}
      </Show>
      <portals.CustomElements elements={pages().elements} />
    </>
  );
};

const _OrganizationSwitcher = withClerk(
  (
    props: WithClerkProp<
      ParentProps<OrganizationSwitcherPropsWithoutCustomPages> & FallbackProp
    >
  ) => {
    const [shared, share] = createSignal<Record<string, unknown>>(
      {},
      { equals: false }
    );
    const isomorphicClerk = () => props.clerk() as unknown as IsomorphicClerk;
    return (
      <OrganizationSwitcherContext.Provider
        value={{
          mount: (node, mountProps) =>
            isomorphicClerk().mountOrganizationSwitcher(node, mountProps),
          unmount: (node) =>
            isomorphicClerk().unmountOrganizationSwitcher(node),
          updateProps: (update) =>
            isomorphicClerk().__internal_updateProps(update),
          props: shared,
          fallback: () => props.fallback,
          asProvider: () => !!props.__experimental_asProvider
        }}
      >
        <OrganizationSwitcherHost {...props} share={share} />
      </OrganizationSwitcherContext.Provider>
    );
  },
  { component: 'OrganizationSwitcher', renderWhileLoading: true }
);

/**
 * Where an `<OrganizationSwitcher __experimental_asProvider>` renders.
 *
 * @experimental This API is experimental and may change at any moment.
 */
export function OrganizationSwitcherOutlet(
  outletProps: Without<OrganizationSwitcherProps, 'organizationProfileProps'>
): JSX.Element {
  const parent = useContext(OrganizationSwitcherContext);
  // Only an asProvider component renders here; any other renders itself.
  const context = () => (parent?.asProvider() ? parent : undefined);
  if (!untrack(context)) {
    logErrorInDevMode(
      '<OrganizationSwitcher.__experimental_Outlet /> renders only inside <OrganizationSwitcher __experimental_asProvider>.'
    );
  }
  return (
    <Show when={context()}>
      {(outlet) => (
        <Portal
          component="OrganizationSwitcher"
          fallback={outlet().fallback()}
          mount={outlet().mount}
          unmount={outlet().unmount}
          updateProps={outlet().updateProps}
          props={{ ...outlet().props(), ...outletProps }}
        />
      )}
    </Show>
  );
}

export const OrganizationSwitcher: OrganizationSwitcherExportType =
  Object.assign(_OrganizationSwitcher, {
    OrganizationProfilePage,
    OrganizationProfileLink,
    __experimental_Outlet: OrganizationSwitcherOutlet
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
    const entries = useCustomChildren(() => local.children);
    const pages = createMemo(() =>
      buildCustomPages(
        entries(),
        userProfileCustomPagesOptions,
        portals.handlersFor
      )
    );
    useBuildWarnings(() => pages().warnings);

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

/**
 * Clerk's choose-organization session task. A session with this task counts
 * as signed out until the user finishes it here.
 */
export const TaskChooseOrganization = withClerk(
  (props: WithClerkProp<TaskChooseOrganizationProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="TaskChooseOrganization"
        fallback={local.fallback}
        mount={local.clerk().mountTaskChooseOrganization}
        unmount={local.clerk().unmountTaskChooseOrganization}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'TaskChooseOrganization', renderWhileLoading: true }
);

/** Clerk's reset-password session task. */
export const TaskResetPassword = withClerk(
  (props: WithClerkProp<TaskResetPasswordProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="TaskResetPassword"
        fallback={local.fallback}
        mount={local.clerk().mountTaskResetPassword}
        unmount={local.clerk().unmountTaskResetPassword}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'TaskResetPassword', renderWhileLoading: true }
);

/** Clerk's set-up-MFA session task. */
export const TaskSetupMFA = withClerk(
  (props: WithClerkProp<TaskSetupMFAProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="TaskSetupMFA"
        fallback={local.fallback}
        mount={local.clerk().mountTaskSetupMFA}
        unmount={local.clerk().unmountTaskSetupMFA}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'TaskSetupMFA', renderWhileLoading: true }
);

/** Clerk's pricing table for your plans. The fallback shows until it has fetched the plans. */
export const PricingTable = withClerk(
  (props: WithClerkProp<PricingTableProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="PricingTable"
        fallback={local.fallback}
        mount={local.clerk().mountPricingTable}
        unmount={local.clerk().unmountPricingTable}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        // Clerk marks the table ready once it has fetched the plans.
        readySelector='[data-component-status="ready"]'
        props={rest}
      />
    );
  },
  { component: 'PricingTable', renderWhileLoading: true }
);

/** Lists and manages the user's or organization's API keys. */
export const APIKeys = withClerk(
  (props: WithClerkProp<APIKeysProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="ApiKeys"
        fallback={local.fallback}
        mount={local.clerk().mountAPIKeys}
        unmount={local.clerk().unmountAPIKeys}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'ApiKeys', renderWhileLoading: true }
);

/** The signed-in user's avatar. */
export const UserAvatar = withClerk(
  (props: WithClerkProp<UserAvatarProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="UserAvatar"
        fallback={local.fallback}
        mount={local.clerk().mountUserAvatar}
        unmount={local.clerk().unmountUserAvatar}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'UserAvatar', renderWhileLoading: true }
);

/** The consent screen an OAuth application shows the signed-in user. */
export const OAuthConsent = withClerk(
  (props: WithClerkProp<OAuthConsentProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="OAuthConsent"
        fallback={local.fallback}
        mount={local.clerk().__internal_mountOAuthConsent}
        unmount={local.clerk().__internal_unmountOAuthConsent}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'OAuthConsent', renderWhileLoading: true }
);

/** The flow a signed-in user authorizes a device or app with. */
export const OAuthDeviceVerification = withClerk(
  (props: WithClerkProp<OAuthDeviceVerificationProps & FallbackProp>) => {
    const [local, rest] = splitProps(props, ['clerk', 'fallback']);
    return (
      <Portal
        component="OAuthDeviceVerification"
        fallback={local.fallback}
        mount={local.clerk().__internal_mountOAuthDeviceVerification}
        unmount={local.clerk().__internal_unmountOAuthDeviceVerification}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__internal_updateProps
        }
        props={rest}
      />
    );
  },
  { component: 'OAuthDeviceVerification', renderWhileLoading: true }
);
