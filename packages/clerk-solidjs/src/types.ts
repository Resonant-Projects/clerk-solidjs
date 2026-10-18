import type {
  Clerk,
  ClerkOptions,
  ClerkPaginatedResponse,
  ClerkUIConstructor,
  ClientResource,
  DomainOrProxyUrl,
  EnvironmentJSON,
  EnvironmentResource,
  InitialState,
  InternalClerkScriptProps,
  LoadedClerk,
  RedirectUrlProp,
  IsomorphicClerkOptions as SharedIsomorphicClerkOptions,
  SignInProps,
  SignInRedirectOptions,
  SignOutOptions,
  SignUpProps,
  SignUpRedirectOptions,
  Without
} from '@clerk/shared/types';
import { Accessor, JSX, JSXElement } from 'solid-js';

declare global {
  interface Window {
    __clerk_publishable_key?: string;
    __clerk_proxy_url?: Clerk['proxyUrl'];
    __clerk_domain?: Clerk['domain'];
    __internal_ClerkUICtor?: ClerkUIConstructor;
  }
}

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type LegacyRedirectProps = {
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
};

export type IsomorphicClerkOptions = SharedIsomorphicClerkOptions &
  LegacyRedirectProps;

// Distributes over the unions inside ClerkOptions (navigation, domain/proxy)
// instead of flattening them like a plain Omit would.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type ClerkProviderProps = DistributiveOmit<
  IsomorphicClerkOptions,
  keyof InternalClerkScriptProps
> & {
  children: JSX.Element;
  initialState?: InitialState;
};

export interface BrowserClerkConstructor {
  new (publishableKey: string, options?: DomainOrProxyUrl): BrowserClerk;
}

export interface HeadlessBrowserClerkConstructor {
  new (
    publishableKey: string,
    options?: DomainOrProxyUrl
  ): HeadlessBrowserClerk;
}

export type WithClerkProp<T = unknown> = T & { clerk: Accessor<LoadedClerk> };

// Clerk object
export interface MountProps {
  mount: (node: HTMLDivElement, props: any) => void;
  unmount: (node: HTMLDivElement) => void;
  updateProps: (props: any) => void;
  props?: any;
}

export interface OpenProps {
  open: (props: any) => void;
  close: () => void;
  props?: any;
}

/**
 * Members of the clerk-js `Clerk` class that IsomorphicClerk forwards to but
 * that the public `Clerk` interface in `@clerk/shared/types` does not declare.
 * `__tests__/clerk-js-contract.test.ts` checks them against `@clerk/clerk-js`,
 * so a rename there fails type-checking instead of silently doing nothing.
 */
export interface ClerkJSInternals {
  __internal_updateProps: (props: any) => Promise<void> | undefined;
  readonly __internal_environment: EnvironmentResource | null | undefined;
  __internal_setEnvironment: (env: EnvironmentJSON) => Promise<void>;
}

export interface HeadlessBrowserClerk extends Clerk {
  load: (opts?: Without<ClerkOptions, 'isSatellite'>) => Promise<void>;
  updateClient: (client: ClientResource) => void;
}

export interface BrowserClerk extends HeadlessBrowserClerk {
  onComponentsReady: Promise<void>;
  components: any;
}

export type ClerkProp =
  | BrowserClerkConstructor
  | BrowserClerk
  | HeadlessBrowserClerk
  | HeadlessBrowserClerkConstructor
  | undefined
  | null;

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: 'redirect' | 'modal';
};

export type SignInButtonProps = ButtonProps &
  Pick<
    SignInProps,
    | 'fallbackRedirectUrl'
    | 'forceRedirectUrl'
    | 'signUpForceRedirectUrl'
    | 'signUpFallbackRedirectUrl'
  >;

export type SignOutButtonProps = ButtonProps &
  Pick<SignOutOptions, 'redirectUrl' | 'sessionId'>;

export type SignUpButtonProps = {
  unsafeMetadata?: SignUpUnsafeMetadata;
} & ButtonProps &
  Pick<
    SignUpProps,
    | 'fallbackRedirectUrl'
    | 'forceRedirectUrl'
    | 'signInForceRedirectUrl'
    | 'signInFallbackRedirectUrl'
  >;

export type SignInWithMetamaskButtonProps = ButtonProps & RedirectUrlProp;

export type RedirectToSignInProps = SignInRedirectOptions;
export type RedirectToSignUpProps = SignUpRedirectOptions;

type PageProps<T extends string> =
  | {
      label: string;
      url: string;
      labelIcon: JSXElement;
    }
  | {
      label: T;
      url?: never;
      labelIcon?: never;
    };

export type UserProfilePageProps = PageProps<
  'account' | 'security' | 'billing' | 'apiKeys'
>;

export type UserProfileLinkProps = {
  url: string;
  label: string;
  labelIcon: JSXElement;
};

export type OrganizationProfilePageProps = PageProps<
  'general' | 'members' | 'billing' | 'apiKeys'
>;
export type OrganizationProfileLinkProps = UserProfileLinkProps;

type ButtonActionProps<T extends string> =
  | {
      label: string;
      labelIcon: JSXElement;
      onClick: () => void;
      open?: never;
    }
  | {
      label: T;
      labelIcon?: never;
      onClick?: never;
      open?: never;
    }
  | {
      label: string;
      labelIcon: JSXElement;
      onClick?: never;
      open: string;
    };

export type UserButtonActionProps = ButtonActionProps<
  'manageAccount' | 'signOut'
>;

export type UserButtonLinkProps = {
  href: string;
  label: string;
  labelIcon: JSXElement;
};

import type { ClerkAPIResponseError } from '@clerk/shared/types';

export type ValueOrSetter<T = unknown> = (size: T | ((_size: T) => T)) => void;

export type CacheSetter<CData = any> = (
  data?:
    | CData
    | ((currentData?: CData) => Promise<undefined | CData> | undefined | CData)
) => Promise<CData | undefined>;

export type PaginatedResources<T = unknown, Infinite = false> = {
  data: () => T[];
  count: () => number;
  error: () => ClerkAPIResponseError | null;
  isLoading: () => boolean;
  isFetching: () => boolean;
  isError: () => boolean;
  page: () => number;
  pageCount: () => number;
  fetchPrevious: () => void;
  fetchNext: () => void;
  hasNextPage: () => boolean;
  hasPreviousPage: () => boolean;
  setData: Infinite extends true
    ? // Array of pages of data
      CacheSetter<(ClerkPaginatedResponse<T> | undefined)[]>
    : // Array of data
      CacheSetter<ClerkPaginatedResponse<T> | undefined>;
  revalidate: () => Promise<void>;
};

// Utility type to convert PaginatedDataAPI to properties as undefined, except booleans set to false
export type PaginatedResourcesWithDefault<T> = {
  [K in keyof PaginatedResources<T>]: PaginatedResources<T>[K] extends boolean
    ? false
    : undefined;
};

export type PaginatedHookConfig<T> = T & {
  /**
   * Persists the previous pages with new ones in the same array
   */
  infinite?: boolean;
  /**
   * Return the previous key's data until the new data has been loaded
   */
  keepPreviousData?: boolean;
};

export type PagesOrInfiniteConfig = PaginatedHookConfig<{
  /**
   * Should a request be triggered
   */
  enabled?: boolean;
}>;

export type PagesOrInfiniteOptions = {
  /**
   * This the starting point for your fetched results. The initial value persists between re-renders
   */
  initialPage?: number;
  /**
   * Maximum number of items returned per request. The initial value persists between re-renders
   */
  pageSize?: number;
};
