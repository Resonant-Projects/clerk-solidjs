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
  Without
} from '@clerk/shared/types';
import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  ParentProps,
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

const isMountProps = (props: any): props is MountProps => {
  return 'mount' in props;
};

const isOpenProps = (props: any): props is OpenProps => {
  return 'open' in props;
};

const Portal: Component<MountProps | OpenProps> = (props) => {
  const [portalRef, setPortalRef] = createSignal<HTMLDivElement>();

  const componentProps = () => props.props;

  createEffect(() => {
    const ref = portalRef();
    if (ref && isMountProps(props)) {
      props.updateProps({
        node: ref,
        props: componentProps()
      });
    }
  });

  onMount(() => {
    const ref = portalRef();
    if (ref) {
      if (isMountProps(props)) {
        props.mount(ref, componentProps());
      } else if (isOpenProps(props)) {
        props.open(componentProps());
      }
    }
  });

  onCleanup(() => {
    const ref = portalRef();
    if (ref) {
      if (isMountProps(props)) {
        props.unmount(ref);
      } else if (isOpenProps(props)) {
        props.close();
      }
    }
  });

  return <div ref={setPortalRef} />;
};

export const SignIn = withClerk((props: WithClerkProp<SignInProps>) => {
  const [local, rest] = splitProps(props, ['clerk']);
  return (
    <Portal
      mount={local.clerk().mountSignIn}
      unmount={local.clerk().unmountSignIn}
      updateProps={
        (local.clerk() as unknown as IsomorphicClerk).__unstable__updateProps
      }
      props={rest}
    />
  );
}, 'SignIn');

export const Waitlist = withClerk((props: WithClerkProp<SignInProps>) => {
  const [local, rest] = splitProps(props, ['clerk']);
  return (
    <Portal
      mount={local.clerk().mountWaitlist}
      unmount={local.clerk().unmountWaitlist}
      updateProps={
        (local.clerk() as unknown as IsomorphicClerk).__unstable__updateProps
      }
      props={rest}
    />
  );
}, 'Waitlist');

export const SignUp = withClerk((props: WithClerkProp<SignUpProps>) => {
  const [local, rest] = splitProps(props, ['clerk']);
  return (
    <Portal
      mount={local.clerk().mountSignUp}
      unmount={local.clerk().unmountSignUp}
      updateProps={
        (local.clerk() as unknown as IsomorphicClerk).__unstable__updateProps
      }
      props={rest}
    />
  );
}, 'SignUp');

const _UserProfile = withClerk(
  (
    props: WithClerkProp<ParentProps<Without<UserProfileProps, 'customPages'>>>
  ) => {
    const [local, clerkProps] = splitProps(props, ['clerk', 'children']);
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
          mount={local.clerk().mountUserProfile}
          unmount={local.clerk().unmountUserProfile}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk)
              .__unstable__updateProps
          }
          props={{ ...clerkProps, customPages: pages().customPages }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  'UserProfile'
);

export const UserProfile: UserProfileExportType = Object.assign(_UserProfile, {
  Page: UserProfilePage,
  Link: UserProfileLink
});

const _UserButton = withClerk(
  (props: WithClerkProp<ParentProps<UserButtonPropsWithoutCustomPages>>) => {
    const [local, clerkProps] = splitProps(props, ['clerk', 'children']);
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
          mount={local.clerk().mountUserButton}
          unmount={local.clerk().unmountUserButton}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk)
              .__unstable__updateProps
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
  'UserButton'
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
      ParentProps<Without<OrganizationProfileProps, 'customPages'>>
    >
  ) => {
    const [local, clerkProps] = splitProps(props, ['clerk', 'children']);
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
          mount={local.clerk().mountOrganizationProfile}
          unmount={local.clerk().unmountOrganizationProfile}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk)
              .__unstable__updateProps
          }
          props={{ ...clerkProps, customPages: pages().customPages }}
        />
        <portals.CustomElements elements={pages().elements} />
      </>
    );
  },
  'OrganizationProfile'
);

export const OrganizationProfile: OrganizationProfileExportType = Object.assign(
  _OrganizationProfile,
  {
    Page: OrganizationProfilePage,
    Link: OrganizationProfileLink
  }
);

export const CreateOrganization = withClerk(
  (props: WithClerkProp<CreateOrganizationProps>) => {
    const [local, rest] = splitProps(props, ['clerk']);
    return (
      <Portal
        mount={local.clerk().mountCreateOrganization}
        unmount={local.clerk().unmountCreateOrganization}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__unstable__updateProps
        }
        props={rest}
      />
    );
  },
  'CreateOrganization'
);

const _OrganizationSwitcher = withClerk(
  (
    props: WithClerkProp<
      ParentProps<OrganizationSwitcherPropsWithoutCustomPages>
    >
  ) => {
    const [local, clerkProps] = splitProps(props, ['clerk', 'children']);
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
          mount={local.clerk().mountOrganizationSwitcher}
          unmount={local.clerk().unmountOrganizationSwitcher}
          updateProps={
            (local.clerk() as unknown as IsomorphicClerk)
              .__unstable__updateProps
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
  'OrganizationSwitcher'
);

export const OrganizationSwitcher: OrganizationSwitcherExportType =
  Object.assign(_OrganizationSwitcher, {
    OrganizationProfilePage,
    OrganizationProfileLink
  });

export const OrganizationList = withClerk(
  (props: WithClerkProp<OrganizationListProps>) => {
    const [local, rest] = splitProps(props, ['clerk']);
    return (
      <Portal
        mount={local.clerk().mountOrganizationList}
        unmount={local.clerk().unmountOrganizationList}
        updateProps={
          (local.clerk() as unknown as IsomorphicClerk).__unstable__updateProps
        }
        props={rest}
      />
    );
  },
  'OrganizationList'
);

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
    // once Clerk has unmounted the pages (the user closed the modal), or it would reopen.
    createEffect(
      on(
        () => pages().customPages,
        (customPages) => {
          if (!untrack(portals.hasMountedNode)) return;
          local.clerk().openUserProfile({ ...updateProps, customPages });
        },
        { defer: true }
      )
    );

    return (
      <>
        <Portal
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
        open={local.clerk().openGoogleOneTap}
        close={local.clerk().closeGoogleOneTap}
        props={rest}
      />
    );
  },
  'GoogleOneTap'
);
