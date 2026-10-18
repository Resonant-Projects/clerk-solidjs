import type { RoutingOptions } from '@clerk/shared/types';
import { useCurrentMatches } from '@solidjs/router';
import { JSX, mergeProps, untrack } from 'solid-js';
import {
  OrganizationList as BaseOrganizationList,
  OrganizationProfile as BaseOrganizationProfile,
  SignIn as BaseSignIn,
  SignUp as BaseSignUp,
  UserProfile as BaseUserProfile
} from '../../components/ui-components';
import { errorThrower } from '../../errors/error-thrower';
import {
  incompatibleRoutingWithPathProvidedError,
  noPathProvidedError
} from '../../errors/messages';

/**
 * The path of the route rendering the component, without its catch-all
 * part: `/sign-in` for `/sign-in/factor-one` on a `sign-in/[...rest]` route.
 * It is read once, at mount: during a navigation away, the router already
 * reports the next route while the component is still mounted.
 */
const useRoutePath = (): string | undefined => {
  const matches = useCurrentMatches();
  return untrack(() => {
    const current = matches();
    return current[current.length - 1]?.path;
  });
};

/**
 * @clerk/react's useRoutingProps: path routing by default, with `path`
 * defaulting to the route's path; a `path` with another routing is an error.
 */
const withRoutingProps = <P extends RoutingOptions>(
  componentName: string,
  props: P,
  routePath: string | undefined
): P => {
  untrack(() => {
    const routing = props.routing ?? 'path';
    if (routing === 'path' && !props.path && !routePath) {
      errorThrower.throw(noPathProvidedError(componentName));
    }
    if (routing !== 'path' && props.path) {
      errorThrower.throw(
        incompatibleRoutingWithPathProvidedError(componentName)
      );
    }
  });
  return mergeProps(props, {
    get routing() {
      return props.routing ?? 'path';
    },
    get path() {
      return (props.routing ?? 'path') === 'path'
        ? (props.path ?? routePath)
        : undefined;
    }
  }) as P;
};

type PropsOf<C> = C extends (props: infer P) => JSX.Element ? P : never;

/**
 * `<SignIn>` with path routing on the current route. Render it on a
 * catch-all route, such as `src/routes/sign-in/[...rest].tsx`, and it needs
 * no `path` prop.
 */
export const SignIn = (props: PropsOf<typeof BaseSignIn>): JSX.Element => {
  const path = useRoutePath();
  return <BaseSignIn {...withRoutingProps('SignIn', props, path)} />;
};

/** `<SignUp>` with path routing on the current route. */
export const SignUp = (props: PropsOf<typeof BaseSignUp>): JSX.Element => {
  const path = useRoutePath();
  return <BaseSignUp {...withRoutingProps('SignUp', props, path)} />;
};

/** `<UserProfile>` with path routing on the current route. */
export const UserProfile: typeof BaseUserProfile = Object.assign(
  (props: PropsOf<typeof BaseUserProfile>): JSX.Element => {
    const path = useRoutePath();
    return (
      <BaseUserProfile {...withRoutingProps('UserProfile', props, path)} />
    );
  },
  { Page: BaseUserProfile.Page, Link: BaseUserProfile.Link }
);

/** `<OrganizationProfile>` with path routing on the current route. */
export const OrganizationProfile: typeof BaseOrganizationProfile =
  Object.assign(
    (props: PropsOf<typeof BaseOrganizationProfile>): JSX.Element => {
      const path = useRoutePath();
      return (
        <BaseOrganizationProfile
          {...withRoutingProps('OrganizationProfile', props, path)}
        />
      );
    },
    { Page: BaseOrganizationProfile.Page, Link: BaseOrganizationProfile.Link }
  );

type OrganizationListProps = PropsOf<typeof BaseOrganizationList>;

/**
 * `<OrganizationList>` with path routing on the current route. Its props
 * type has no routing options, but @clerk/tanstack-react-start passes them
 * all the same, for the flows it opens.
 */
export const OrganizationList = (props: OrganizationListProps): JSX.Element => {
  const path = useRoutePath();
  const routed = withRoutingProps(
    'OrganizationList',
    props as OrganizationListProps & RoutingOptions,
    path
  ) as OrganizationListProps;
  return <BaseOrganizationList {...routed} />;
};
