import type { CustomMenuItem, CustomPage } from '@clerk/shared/types';
import { logErrorInDevMode } from '@clerk/shared/utils';
import {
  createToken,
  createTokenizer,
  isToken,
  resolveTokens,
  type TokenElement
} from '@solid-primitives/jsx-tokenizer';
import type { Accessor, JSX, ParentProps } from 'solid-js';
import {
  customLinkWrongProps,
  customMenuItemsIgnoredComponent,
  customPagesIgnoredComponent,
  customPageWrongProps,
  organizationProfileLinkRenderedError,
  organizationProfilePageRenderedError,
  userButtonIgnoredComponent,
  userButtonMenuActionRenderedError,
  userButtonMenuItemActionMissingTarget,
  userButtonMenuItemLinkWrongProps,
  userButtonMenuItemsActionWrongsProps,
  userButtonMenuItemsRenderedError,
  userButtonMenuLinkRenderedError,
  userProfileLinkRenderedError,
  userProfilePageRenderedError
} from '../errors/messages';
import type {
  OrganizationProfileLinkProps,
  OrganizationProfilePageProps,
  UserButtonActionProps,
  UserButtonLinkProps,
  UserProfileLinkProps,
  UserProfilePageProps
} from '../types';
import {
  createPortalIdFactory,
  type CustomElement,
  type CustomElementHandlers,
  renderProp
} from './custom-element-portals';

/*
 * Solid has no element types to inspect, so the custom page and menu item
 * components are JSX tokens: they hand their props to the parent Clerk
 * component instead of rendering. The parent turns them into Clerk's
 * `customPages` / `customMenuItems`, following `useCustomPages` and
 * `useCustomMenuItems` in `@clerk/react`.
 */

type MenuItemToken =
  | { kind: 'action'; props: UserButtonActionProps }
  | { kind: 'link'; props: UserButtonLinkProps };

type ResolvedEntries<T> = Accessor<(TokenElement<T> | JSX.Element)[]>;

type CustomChildToken =
  | { kind: 'userProfilePage'; props: ParentProps<UserProfilePageProps> }
  | { kind: 'userProfileLink'; props: UserProfileLinkProps }
  | {
      kind: 'organizationProfilePage';
      props: ParentProps<OrganizationProfilePageProps>;
    }
  | { kind: 'organizationProfileLink'; props: OrganizationProfileLinkProps }
  | {
      kind: 'menuItems';
      props: ParentProps;
      items: ResolvedEntries<MenuItemToken>;
    };

const CustomChildrenTokenizer = createTokenizer<CustomChildToken>({
  name: 'Clerk custom pages'
});

const MenuItemTokenizer = createTokenizer<MenuItemToken>({
  name: 'Clerk custom menu items'
});

const renderedOutsideParent = (message: string) => () => {
  logErrorInDevMode(message);
  return null;
};

export const UserProfilePage = createToken<
  ParentProps<UserProfilePageProps>,
  CustomChildToken
>(
  CustomChildrenTokenizer,
  (props) => ({ kind: 'userProfilePage', props }),
  renderedOutsideParent(userProfilePageRenderedError)
);

export const UserProfileLink = createToken<
  UserProfileLinkProps,
  CustomChildToken
>(
  CustomChildrenTokenizer,
  (props) => ({ kind: 'userProfileLink', props }),
  renderedOutsideParent(userProfileLinkRenderedError)
);

export const OrganizationProfilePage = createToken<
  ParentProps<OrganizationProfilePageProps>,
  CustomChildToken
>(
  CustomChildrenTokenizer,
  (props) => ({ kind: 'organizationProfilePage', props }),
  renderedOutsideParent(organizationProfilePageRenderedError)
);

export const OrganizationProfileLink = createToken<
  OrganizationProfileLinkProps,
  CustomChildToken
>(
  CustomChildrenTokenizer,
  (props) => ({ kind: 'organizationProfileLink', props }),
  renderedOutsideParent(organizationProfileLinkRenderedError)
);

export const MenuItems = createToken<ParentProps, CustomChildToken>(
  CustomChildrenTokenizer,
  (props) => ({
    kind: 'menuItems',
    props,
    items: resolveTokens(MenuItemTokenizer, () => props.children, {
      includeJSXElements: true
    })
  }),
  renderedOutsideParent(userButtonMenuItemsRenderedError)
);

export const MenuAction = createToken<UserButtonActionProps, MenuItemToken>(
  MenuItemTokenizer,
  (props) => ({ kind: 'action', props }),
  renderedOutsideParent(userButtonMenuActionRenderedError)
);

export const MenuLink = createToken<UserButtonLinkProps, MenuItemToken>(
  MenuItemTokenizer,
  (props) => ({ kind: 'link', props }),
  renderedOutsideParent(userButtonMenuLinkRenderedError)
);

/**
 * Resolves the children of a Clerk component into custom page and menu item
 * tokens, keeping any other JSX so it can be reported as ignored.
 */
export const resolveCustomChildren = (children: Accessor<JSX.Element>) =>
  resolveTokens(CustomChildrenTokenizer, children, {
    includeJSXElements: true
  });

const isEmptyChild = (value: unknown) =>
  value == null || value === false || value === true || value === '';

/** True when a prop holds JSX, without evaluating the JSX getter. */
const hasJSXProp = (props: object, key: string) => {
  // Solid's spread-props proxy describes every key, present or not, but its
  // `has` trap is exact, so check membership first.
  if (!(key in props)) {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(props, key);
  return (
    !!descriptor &&
    (typeof descriptor.get === 'function' || descriptor.value != null)
  );
};

type PortalHandlersFor = (id: string) => CustomElementHandlers;

type CustomPagesOptions = {
  componentName: 'UserProfile' | 'OrganizationProfile';
  pageKind: 'userProfilePage' | 'organizationProfilePage';
  linkKind: 'userProfileLink' | 'organizationProfileLink';
  reorderItemsLabels: string[];
  /** UserButton also accepts MenuItems beside its pages. */
  ignoredComponentMessage?: string;
  allowMenuItems?: boolean;
};

export const userProfileCustomPagesOptions: CustomPagesOptions = {
  componentName: 'UserProfile',
  pageKind: 'userProfilePage',
  linkKind: 'userProfileLink',
  reorderItemsLabels: ['account', 'security', 'billing', 'apiKeys']
};

export const userButtonCustomPagesOptions: CustomPagesOptions = {
  ...userProfileCustomPagesOptions,
  ignoredComponentMessage: userButtonIgnoredComponent,
  allowMenuItems: true
};

export const organizationProfileCustomPagesOptions: CustomPagesOptions = {
  componentName: 'OrganizationProfile',
  pageKind: 'organizationProfilePage',
  linkKind: 'organizationProfileLink',
  reorderItemsLabels: ['general', 'members', 'billing', 'apiKeys']
};

export const buildCustomPages = (
  entries: (TokenElement<CustomChildToken> | JSX.Element)[],
  options: CustomPagesOptions,
  handlersFor: PortalHandlersFor
) => {
  const customPages: CustomPage[] = [];
  const elements: CustomElement[] = [];
  const nextId = createPortalIdFactory();
  const ignoredMessage =
    options.ignoredComponentMessage ??
    customPagesIgnoredComponent(options.componentName);

  for (const entry of entries) {
    if (!isToken(CustomChildrenTokenizer, entry)) {
      if (!isEmptyChild(entry)) {
        logErrorInDevMode(ignoredMessage);
      }
      continue;
    }

    const token = entry.data;
    if (token.kind === 'menuItems' && options.allowMenuItems) {
      continue;
    }

    if (token.kind === options.pageKind) {
      const props = token.props as ParentProps<UserProfilePageProps>;
      const hasChildren = hasJSXProp(props, 'children');
      const hasIcon = hasJSXProp(props, 'labelIcon');

      if (
        !hasChildren &&
        !props.url &&
        !hasIcon &&
        options.reorderItemsLabels.includes(props.label)
      ) {
        customPages.push({ label: props.label });
      } else if (hasChildren && props.url && hasIcon && props.label) {
        const id = nextId('page', props.label, props.url);
        const content = handlersFor(`content:${id}`);
        const icon = handlersFor(`icon:${id}`);
        customPages.push({
          label: props.label,
          url: props.url,
          mount: content.mount,
          unmount: content.unmount,
          mountIcon: icon.mount,
          unmountIcon: icon.unmount
        });
        elements.push(
          { id: `content:${id}`, render: renderProp(props, 'children') },
          { id: `icon:${id}`, render: renderProp(props, 'labelIcon') }
        );
      } else {
        logErrorInDevMode(customPageWrongProps(options.componentName));
      }
      continue;
    }

    if (token.kind === options.linkKind) {
      const props = token.props as UserProfileLinkProps;
      if (
        !hasJSXProp(props, 'children') &&
        props.url &&
        hasJSXProp(props, 'labelIcon') &&
        props.label
      ) {
        const id = nextId('link', props.label, props.url);
        const icon = handlersFor(`icon:${id}`);
        customPages.push({
          label: props.label,
          url: props.url,
          mountIcon: icon.mount,
          unmountIcon: icon.unmount
        });
        elements.push({
          id: `icon:${id}`,
          render: renderProp(props, 'labelIcon')
        });
      } else {
        logErrorInDevMode(customLinkWrongProps(options.componentName));
      }
      continue;
    }

    logErrorInDevMode(ignoredMessage);
  }

  return { customPages, elements };
};

const USER_BUTTON_REORDER_LABELS = ['manageAccount', 'signOut'];

export const buildUserButtonMenuItems = (
  entries: (TokenElement<CustomChildToken> | JSX.Element)[],
  handlersFor: PortalHandlersFor
) => {
  const customMenuItems: CustomMenuItem[] = [];
  const elements: CustomElement[] = [];
  const nextId = createPortalIdFactory();

  for (const entry of entries) {
    if (
      !isToken(CustomChildrenTokenizer, entry) ||
      entry.data.kind !== 'menuItems'
    ) {
      continue;
    }

    for (const item of entry.data.items()) {
      if (!isToken(MenuItemTokenizer, item)) {
        if (!isEmptyChild(item)) {
          logErrorInDevMode(customMenuItemsIgnoredComponent);
        }
        continue;
      }

      const token = item.data;
      const hasIcon = hasJSXProp(token.props, 'labelIcon');

      if (token.kind === 'action') {
        const props = token.props;
        if (
          !hasIcon &&
          !props.onClick &&
          !hasJSXProp(props, 'children') &&
          USER_BUTTON_REORDER_LABELS.includes(props.label)
        ) {
          customMenuItems.push({ label: props.label });
          continue;
        }

        if (!hasIcon || !props.label) {
          logErrorInDevMode(userButtonMenuItemsActionWrongsProps);
          continue;
        }

        const onClick = props.onClick;
        const open = props.open;
        if (typeof onClick !== 'function' && typeof open !== 'string') {
          logErrorInDevMode(userButtonMenuItemActionMissingTarget);
          continue;
        }

        const id = nextId('menu-action', props.label, open);
        const icon = handlersFor(`icon:${id}`);
        const menuItem: CustomMenuItem = {
          label: props.label,
          mountIcon: icon.mount,
          unmountIcon: icon.unmount
        };
        if (typeof onClick === 'function') {
          menuItem.onClick = onClick;
        } else if (typeof open === 'string') {
          menuItem.open = open.startsWith('/') ? open : `/${open}`;
        }
        customMenuItems.push(menuItem);
        elements.push({
          id: `icon:${id}`,
          render: renderProp(props, 'labelIcon')
        });
        continue;
      }

      const props = token.props;
      if (props.href && hasIcon && props.label) {
        const id = nextId('menu-link', props.label, props.href);
        const icon = handlersFor(`icon:${id}`);
        customMenuItems.push({
          label: props.label,
          href: props.href,
          mountIcon: icon.mount,
          unmountIcon: icon.unmount
        });
        elements.push({
          id: `icon:${id}`,
          render: renderProp(props, 'labelIcon')
        });
      } else {
        logErrorInDevMode(userButtonMenuItemLinkWrongProps);
      }
    }
  }

  return { customMenuItems, elements };
};
