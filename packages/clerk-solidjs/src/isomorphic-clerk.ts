import { inBrowser } from '@clerk/shared/browser';
import type {
  APIKeysNamespace,
  AuthenticateWithBaseParams,
  AuthenticateWithCoinbaseWalletParams,
  AuthenticateWithGoogleOneTapParams,
  AuthenticateWithMetamaskParams,
  AuthenticateWithOKXWalletParams,
  AuthenticateWithSolanaParams,
  BillingNamespace,
  Clerk,
  ClerkAuthenticateWithWeb3Params,
  ClientResource,
  CreateOrganizationParams,
  HandleEmailLinkVerificationParams,
  HandleOAuthCallbackParams,
  JoinWaitlistParams,
  ListenerCallback,
  ListenerOptions,
  LoadedClerk,
  OAuthApplicationNamespace,
  OrganizationResource,
  ProtectCheckFlow,
  ResumeAfterProtectCheckParams,
  SignInRedirectOptions,
  SignInResource,
  SignUpRedirectOptions,
  SignUpResource,
  TasksRedirectOptions,
  UnsubscribeCallback,
  WaitlistResource,
  Without
} from '@clerk/shared/types';

import type { IsomorphicClerkOptions } from './types';

import { IsomorphicClerkMounts } from './isomorphic-clerk/mounts';

type WithVoidReturn<F extends (...args: any) => any> = (
  ...args: Parameters<F>
) => ReturnType<F> extends Promise<infer T>
  ? Promise<T | void>
  : ReturnType<F> | void;
type WithVoidReturnFunctions<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any
    ? WithVoidReturn<T[K]>
    : T[K];
};

/**
 * @clerk/react's contract: every `LoadedClerk` member, with methods allowed
 * to return nothing while clerk-js loads.
 */
type IsomorphicLoadedClerk = Without<
  WithVoidReturnFunctions<LoadedClerk>,
  | 'client'
  | '__internal_addNavigationListener'
  | '__internal_getCachedResources'
  | '__internal_reloadInitialResources'
  | 'billing'
  | 'apiKeys'
  | 'oauthApplication'
  | '__internal_setActiveInProgress'
> & {
  client: ClientResource | undefined;
  billing: BillingNamespace | undefined;
  apiKeys: APIKeysNamespace | undefined;
  oauthApplication: OAuthApplicationNamespace | undefined;
};

/**
 * The Clerk instance this SDK hands out: a stand-in for clerk-js until it has
 * loaded. Its members are split across the layers in `./isomorphic-clerk/`
 * (queue, core, resources, modals, mounts) to keep each file small.
 */
export class IsomorphicClerk
  extends IsomorphicClerkMounts
  implements IsomorphicLoadedClerk
{
  static #instance: IsomorphicClerk | null | undefined;
  /** The providers using `#instance`: separate roots can share it. */
  static #instanceUsers = 0;

  static getOrCreateInstance(options: IsomorphicClerkOptions) {
    // During SSR: a new instance should be created for every request
    // During CSR: use the cached instance for the whole lifetime of the app
    // Also will recreate the instance if the provided Clerk instance changes
    // This method should be idempotent in both scenarios
    if (
      !inBrowser() ||
      !this.#instance ||
      (options.Clerk && this.#instance.Clerk !== options.Clerk) ||
      // Allow hot swapping PKs on the client
      this.#instance.publishableKey !== options.publishableKey
    ) {
      this.#instance = new IsomorphicClerk(options);
      this.#instanceUsers = 0;
    }
    this.#instanceUsers++;
    return this.#instance;
  }

  /**
   * A provider is done with its instance. The shared one is cleared once no
   * provider uses it, so another root still mounted keeps it, and the next
   * root to mount reuses it.
   */
  static releaseInstance(instance: IsomorphicClerk) {
    if (instance !== this.#instance) return;
    this.#instanceUsers--;
    if (this.#instanceUsers <= 0) this.clearInstance();
  }

  static clearInstance() {
    this.#instance = null;
    this.#instanceUsers = 0;
  }

  constructor(options: IsomorphicClerkOptions) {
    super(options);
    this.startLoading();
  }

  addListener = (
    listener: ListenerCallback,
    options?: ListenerOptions
  ): UnsubscribeCallback => {
    if (this.clerkjs) {
      return this.clerkjs.addListener(listener, options);
    } else {
      const unsubscribe = () => {
        const listenerHandlers = this.premountAddListenerCalls.get(listener);
        if (listenerHandlers) {
          listenerHandlers.nativeUnsubscribe?.();
          this.premountAddListenerCalls.delete(listener);
        }
      };
      this.premountAddListenerCalls.set(listener, {
        options,
        unsubscribe,
        nativeUnsubscribe: undefined
      });
      return unsubscribe;
    }
  };

  navigate = (to: string) => {
    const callback = () => this.clerkjs?.navigate(to);
    if (this.clerkjs && this.loaded) {
      void callback();
    } else {
      this.premountMethodCalls.set('navigate', callback);
    }
  };

  redirectWithAuth = async (...args: Parameters<Clerk['redirectWithAuth']>) => {
    const callback = () => this.clerkjs?.redirectWithAuth(...args);
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectWithAuth', callback);
      return;
    }
  };

  redirectToSignIn = async (opts?: SignInRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToSignIn(opts as any);
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToSignIn', callback);
      return;
    }
  };

  redirectToSignUp = async (opts?: SignUpRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToSignUp(opts as any);
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToSignUp', callback);
      return;
    }
  };

  redirectToUserProfile = async () => {
    const callback = () => this.clerkjs?.redirectToUserProfile();
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToUserProfile', callback);
      return;
    }
  };

  redirectToAfterSignUp = (): void => {
    const callback = () => this.clerkjs?.redirectToAfterSignUp();
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignUp', callback);
    }
  };

  redirectToAfterSignIn = () => {
    const callback = () => this.clerkjs?.redirectToAfterSignIn();
    if (this.clerkjs && this.loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignIn', callback);
    }
  };

  redirectToAfterSignOut = () => {
    const callback = () => this.clerkjs?.redirectToAfterSignOut();
    if (this.clerkjs && this.loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignOut', callback);
    }
  };

  redirectToOrganizationProfile = async () => {
    const callback = () => this.clerkjs?.redirectToOrganizationProfile();
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToOrganizationProfile', callback);
      return;
    }
  };

  redirectToCreateOrganization = async () => {
    const callback = () => this.clerkjs?.redirectToCreateOrganization();
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToCreateOrganization', callback);
      return;
    }
  };

  redirectToWaitlist = async () => {
    const callback = () => this.clerkjs?.redirectToWaitlist();
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToWaitlist', callback);
      return;
    }
  };

  redirectToTasks = async (opts?: TasksRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToTasks(opts);
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToTasks', callback);
      return;
    }
  };

  /** Resolves a bot-protection check pending after an SSO redirect. */
  __internal_resolvePendingProtectCheck = async (
    flow?: ProtectCheckFlow
  ): Promise<void> => {
    await this.clerkjs?.__internal_resolvePendingProtectCheck?.(flow);
  };

  __internal_resumeAfterProtectCheck = async (
    params?: ResumeAfterProtectCheckParams,
    customNavigate?: (to: string) => Promise<unknown>
  ): Promise<void> => {
    const callback = () => {
      const clerkjs = this.clerkjs;
      // An older clerk-js has no bot-protection checks.
      if (typeof clerkjs?.__internal_resumeAfterProtectCheck !== 'function') {
        return;
      }
      void clerkjs
        .__internal_resumeAfterProtectCheck(params, customNavigate)
        ?.catch(() => {});
    };
    if (this.clerkjs && this.loaded) {
      callback();
    } else {
      this.premountMethodCalls.set(
        '__internal_resumeAfterProtectCheck',
        callback
      );
    }
  };

  __internal_handleResourceCallback = async (
    signInOrUp: SignInResource | SignUpResource,
    params: HandleOAuthCallbackParams,
    customNavigate?: (to: string) => Promise<unknown>
  ): Promise<unknown> => {
    const callback = () =>
      this.clerkjs?.__internal_handleResourceCallback(
        signInOrUp,
        params,
        customNavigate
      );
    if (this.clerkjs && this.loaded) {
      return callback();
    }
    this.premountMethodCalls.set('__internal_handleResourceCallback', callback);
    return;
  };

  handleRedirectCallback = async (
    params: HandleOAuthCallbackParams
  ): Promise<void> => {
    const callback = () => this.clerkjs?.handleRedirectCallback(params);
    if (this.clerkjs && this.loaded) {
      void callback()?.catch(() => {
        // This error is caused when the host app is using React18
        // and strictMode is enabled. This useEffects runs twice because
        // the clerk-react ui components mounts, unmounts and mounts again
        // so the clerk-js component loses its state because of the custom
        // unmount callback we're using.
        // This needs to be solved by tweaking the logic in uiComponents.tsx
        // or by making handleRedirectCallback idempotent
      });
    } else {
      this.premountMethodCalls.set('handleRedirectCallback', callback);
    }
  };

  handleGoogleOneTapCallback = async (
    signInOrUp: SignInResource | SignUpResource,
    params: HandleOAuthCallbackParams
  ): Promise<void> => {
    const callback = () =>
      this.clerkjs?.handleGoogleOneTapCallback(signInOrUp, params);
    if (this.clerkjs && this.loaded) {
      void callback()?.catch(() => {
        // This error is caused when the host app is using React18
        // and strictMode is enabled. This useEffects runs twice because
        // the clerk-react ui components mounts, unmounts and mounts again
        // so the clerk-js component loses its state because of the custom
        // unmount callback we're using.
        // This needs to be solved by tweaking the logic in uiComponents.tsx
        // or by making handleRedirectCallback idempotent
      });
    } else {
      this.premountMethodCalls.set('handleGoogleOneTapCallback', callback);
    }
  };

  handleEmailLinkVerification = async (
    params: HandleEmailLinkVerificationParams
  ) => {
    const callback = () => this.clerkjs?.handleEmailLinkVerification(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('handleEmailLinkVerification', callback);
    }
  };

  authenticateWithMetamask = async (
    params?: AuthenticateWithMetamaskParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithMetamask(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithMetamask', callback);
    }
  };

  authenticateWithCoinbaseWallet = async (
    params?: AuthenticateWithCoinbaseWalletParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithCoinbaseWallet(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithCoinbaseWallet', callback);
    }
  };

  authenticateWithOKXWallet = async (
    params?: AuthenticateWithOKXWalletParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithOKXWallet(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithOKXWallet', callback);
    }
  };

  authenticateWithBase = async (params?: AuthenticateWithBaseParams) => {
    const callback = () => this.clerkjs?.authenticateWithBase(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithBase', callback);
    }
  };

  authenticateWithSolana = async (params: AuthenticateWithSolanaParams) => {
    const callback = () => this.clerkjs?.authenticateWithSolana(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithSolana', callback);
    }
  };

  authenticateWithWeb3 = async (params: ClerkAuthenticateWithWeb3Params) => {
    const callback = () => this.clerkjs?.authenticateWithWeb3(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithWeb3', callback);
    }
  };

  authenticateWithGoogleOneTap = async (
    params: AuthenticateWithGoogleOneTapParams
  ) => {
    const clerkjs = await this.waitForClerkJS();
    return clerkjs.authenticateWithGoogleOneTap(params);
  };

  createOrganization = async (
    params: CreateOrganizationParams
  ): Promise<OrganizationResource | void> => {
    const callback = () => this.clerkjs?.createOrganization(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<OrganizationResource>;
    } else {
      this.premountMethodCalls.set('createOrganization', callback);
    }
  };

  getOrganization = async (
    organizationId: string
  ): Promise<OrganizationResource | void> => {
    const callback = () => this.clerkjs?.getOrganization(organizationId);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<OrganizationResource>;
    } else {
      this.premountMethodCalls.set('getOrganization', callback);
    }
  };

  joinWaitlist = async (
    params: JoinWaitlistParams
  ): Promise<WaitlistResource | void> => {
    const callback = () => this.clerkjs?.joinWaitlist(params);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<WaitlistResource>;
    } else {
      this.premountMethodCalls.set('joinWaitlist', callback);
    }
  };

  signOut = async (...args: Parameters<Clerk['signOut']>) => {
    const callback = () => this.clerkjs?.signOut(...args);
    if (this.clerkjs && this.loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('signOut', callback);
    }
  };
}
