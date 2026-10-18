import { inBrowser } from '@clerk/shared/browser';
import { clerkEvents, createClerkEventBus } from '@clerk/shared/clerkEventBus';
import {
  ALLOWED_PROTOCOLS,
  windowNavigate
} from '@clerk/shared/internal/clerk-js/windowNavigate';
import {
  loadClerkJSScript,
  loadClerkUIScript,
  setClerkJSLoadingErrorPackageName
} from '@clerk/shared/loadClerkJsScript';
import type { ModuleManager } from '@clerk/shared/moduleManager';
import type {
  __internal_AttemptToEnableEnvironmentSettingParams,
  __internal_AttemptToEnableEnvironmentSettingResult,
  __internal_EnableOrganizationsPromptProps,
  __internal_UserVerificationModalProps,
  __internal_UserVerificationProps,
  APIKeysNamespace,
  APIKeysProps,
  AuthenticateWithBaseParams,
  AuthenticateWithCoinbaseWalletParams,
  AuthenticateWithGoogleOneTapParams,
  AuthenticateWithMetamaskParams,
  AuthenticateWithOKXWalletParams,
  AuthenticateWithSolanaParams,
  Clerk,
  ClerkAuthenticateWithWeb3Params,
  ClerkOptions,
  ClerkStatus,
  ClerkUIConstructor,
  ClientResource,
  ConfigureSSOProps,
  CreateOrganizationParams,
  CreateOrganizationProps,
  DomainOrProxyUrl,
  EnvironmentJSON,
  EnvironmentResource,
  GoogleOneTapProps,
  HandleEmailLinkVerificationParams,
  HandleOAuthCallbackParams,
  InviteMembersModalProps,
  JoinWaitlistParams,
  ListenerCallback,
  ListenerOptions,
  LoadedClerk,
  OAuthApplicationNamespace,
  OAuthConsentProps,
  OAuthDeviceVerificationProps,
  OrganizationListProps,
  OrganizationProfileProps,
  OrganizationResource,
  OrganizationSwitcherProps,
  PricingTableProps,
  ProtectAssertion,
  ProtectCheckFlow,
  RedirectOptions,
  Resources,
  ResumeAfterProtectCheckParams,
  SDKMetadata,
  SetActiveParams,
  SignInProps,
  SignInRedirectOptions,
  SignInResource,
  SignUpProps,
  SignUpRedirectOptions,
  SignUpResource,
  State,
  TaskChooseOrganizationProps,
  TaskResetPasswordProps,
  TaskSetupMFAProps,
  TasksRedirectOptions,
  UnsubscribeCallback,
  UserAvatarProps,
  UserButtonProps,
  UserProfileProps,
  WaitlistProps,
  WaitlistResource,
  Without
} from '@clerk/shared/types';
import { handleValueOrFn, logErrorInDevMode } from '@clerk/shared/utils';

import { errorThrower } from './errors/error-thrower';
import { unsupportedNonBrowserDomainOrProxyUrlFunction } from './errors/messages';
import { installGlobalPolyfill } from './polyfills';
import { StateProxy } from './state-proxy';
import type {
  BrowserClerk,
  BrowserClerkConstructor,
  ClerkJSInternals,
  ClerkProp,
  HeadlessBrowserClerk,
  HeadlessBrowserClerkConstructor,
  IsomorphicClerkOptions
} from './types';
import { isConstructor } from './utils';

/**
 * True when the app's bundler defines `__BUILD_DISABLE_RHC__` (or the global
 * is set) to turn off loading Clerk from the CDN. `typeof` keeps this safe
 * when it is undefined, so nothing needs setting at import.
 */
const remotelyHostedCodeDisabled = () =>
  typeof __BUILD_DISABLE_RHC__ !== 'undefined' && !!__BUILD_DISABLE_RHC__;

const SDK_METADATA = {
  name: PACKAGE_NAME,
  version: PACKAGE_VERSION,
  environment: process.env.NODE_ENV
};

declare global {
  var Clerk: HeadlessBrowserClerk | BrowserClerk | undefined;
  var __internal_ClerkUICtor: ClerkUIConstructor | undefined;
}

type GenericFunction<TArgs = never> = (...args: TArgs[]) => unknown;

type MethodName<T> = {
  [P in keyof T]: T[P] extends GenericFunction ? P : never;
}[keyof T];

type MethodCallback = () => Promise<unknown> | unknown;

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
 * `LoadedClerk` members IsomorphicClerk does not forward yet, by the
 * hill-climb feature that adds them. Every other member must exist, so a
 * member Clerk adds upstream is a type error until it is ported or listed.
 */
type NotYetSupported =
  // F37 to F40: billing.
  | '__experimental_checkout'
  | '__internal_openCheckout'
  | '__internal_closeCheckout'
  | '__internal_openPlanDetails'
  | '__internal_closePlanDetails'
  | '__internal_openSubscriptionDetails'
  | '__internal_closeSubscriptionDetails'
  | 'buildNewSubscriptionRedirectUrl'
  | '__internal_loadStripeJs';

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
  | NotYetSupported
> & {
  client: ClientResource | undefined;
  apiKeys: APIKeysNamespace | undefined;
  oauthApplication: OAuthApplicationNamespace | undefined;
};

export class IsomorphicClerk implements IsomorphicLoadedClerk {
  private readonly mode: 'browser' | 'server';
  private readonly options: IsomorphicClerkOptions;
  private readonly Clerk: ClerkProp;
  private clerkjs: BrowserClerk | HeadlessBrowserClerk | null = null;
  private preopenOneTap?: null | GoogleOneTapProps = null;
  private preopenUserVerification?: null | __internal_UserVerificationProps =
    null;
  private preopenSignIn?: null | SignInProps = null;
  private preopenSignUp?: null | SignUpProps = null;
  private preopenUserProfile?: null | UserProfileProps = null;
  private preopenOrganizationProfile?: null | OrganizationProfileProps = null;
  private preopenCreateOrganization?: null | CreateOrganizationProps = null;
  private preOpenWaitlist?: null | WaitlistProps = null;
  private preopenInviteMembers?: null | InviteMembersModalProps = null;
  private preopenEnableOrganizationsPrompt?: null | __internal_EnableOrganizationsPromptProps =
    null;
  private premountSignInNodes = new Map<
    HTMLDivElement,
    SignInProps | undefined
  >();
  private premountSignUpNodes = new Map<
    HTMLDivElement,
    SignUpProps | undefined
  >();
  private premountUserProfileNodes = new Map<
    HTMLDivElement,
    UserProfileProps | undefined
  >();
  private premountUserButtonNodes = new Map<
    HTMLDivElement,
    UserButtonProps | undefined
  >();
  private premountOrganizationProfileNodes = new Map<
    HTMLDivElement,
    OrganizationProfileProps | undefined
  >();
  private premountCreateOrganizationNodes = new Map<
    HTMLDivElement,
    CreateOrganizationProps | undefined
  >();
  private premountOrganizationSwitcherNodes = new Map<
    HTMLDivElement,
    OrganizationSwitcherProps | undefined
  >();
  private premountOrganizationListNodes = new Map<
    HTMLDivElement,
    OrganizationListProps | undefined
  >();
  private premountMethodCalls = new Map<
    MethodName<BrowserClerk>,
    MethodCallback
  >();
  private premountWaitlistNodes = new Map<
    HTMLDivElement,
    WaitlistProps | undefined
  >();
  private premountPricingTableNodes = new Map<
    HTMLDivElement,
    PricingTableProps | undefined
  >();
  private premountUserAvatarNodes = new Map<
    HTMLDivElement,
    UserAvatarProps | undefined
  >();
  private premountAPIKeysNodes = new Map<
    HTMLDivElement,
    APIKeysProps | undefined
  >();
  private premountConfigureSSONodes = new Map<
    HTMLDivElement,
    ConfigureSSOProps | undefined
  >();
  private premountConfigureDirectorySyncNodes = new Map<
    HTMLDivElement,
    ConfigureSSOProps | undefined
  >();
  private premountOAuthConsentNodes = new Map<
    HTMLDivElement,
    OAuthConsentProps | undefined
  >();
  private premountOAuthDeviceVerificationNodes = new Map<
    HTMLDivElement,
    OAuthDeviceVerificationProps | undefined
  >();
  private premountTaskChooseOrganizationNodes = new Map<
    HTMLDivElement,
    TaskChooseOrganizationProps | undefined
  >();
  private premountTaskResetPasswordNodes = new Map<
    HTMLDivElement,
    TaskResetPasswordProps | undefined
  >();
  private premountTaskSetupMFANodes = new Map<
    HTMLDivElement,
    TaskSetupMFAProps | undefined
  >();
  // A separate Map of `addListener` method calls to handle multiple listeners.
  private premountAddListenerCalls = new Map<
    ListenerCallback,
    {
      options?: ListenerOptions;
      unsubscribe: UnsubscribeCallback;
      nativeUnsubscribe?: UnsubscribeCallback;
    }
  >();
  private loadedListeners: Array<() => void> = [];

  #loaded = false;
  #status: ClerkStatus = 'loading';
  #eventBus = createClerkEventBus();
  #domain: DomainOrProxyUrl['domain'];
  #proxyUrl: DomainOrProxyUrl['proxyUrl'];
  #publishableKey: string;
  #sdkMetadata: SDKMetadata;
  #stateProxy: StateProxy;

  get publishableKey(): string {
    return this.#publishableKey;
  }

  get loaded(): boolean {
    return this.#loaded;
  }

  /**
   * `'loading'` until clerk-js is ready, `'error'` if it failed to load, and
   * clerk-js's own status (`'ready'` or `'degraded'`) after that.
   */
  get status(): ClerkStatus {
    if (!this.clerkjs) {
      return this.#status;
    }
    // A clerk-js without `status` predates `'degraded'` and `'error'`.
    return this.clerkjs.status || (this.clerkjs.loaded ? 'ready' : 'loading');
  }

  static #instance: IsomorphicClerk | null | undefined;

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
    }
    return this.#instance;
  }

  static clearInstance() {
    this.#instance = null;
  }

  get domain(): string {
    // This getter can run in environments where window is not available.
    // In those cases we should expect and use domain as a string
    if (typeof window !== 'undefined' && window.location) {
      return handleValueOrFn(this.#domain, new URL(window.location.href), '');
    }
    if (typeof this.#domain === 'function') {
      return errorThrower.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return this.#domain || '';
  }

  get proxyUrl(): string {
    // This getter can run in environments where window is not available.
    // In those cases we should expect and use proxy as a string
    if (typeof window !== 'undefined' && window.location) {
      return handleValueOrFn(this.#proxyUrl, new URL(window.location.href), '');
    }
    if (typeof this.#proxyUrl === 'function') {
      return errorThrower.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return this.#proxyUrl || '';
  }

  /**
   * An option clerk-js was loaded with. Before it loads, and on the server,
   * the option this instance was created with.
   */
  public __internal_getOption<K extends keyof ClerkOptions>(
    key: K
  ): ClerkOptions[K] | undefined {
    return this.clerkjs?.__internal_getOption
      ? this.clerkjs.__internal_getOption(key)
      : (this.options as ClerkOptions)[key];
  }

  /**
   * Navigates the window. An older clerk-js lacks this, so navigate here
   * with the same protocol allowlist rather than do nothing.
   */
  public __internal_windowNavigate: Clerk['__internal_windowNavigate'] = (
    to,
    opts
  ) => {
    const clerkjs = this.clerkjs;
    if (typeof clerkjs?.__internal_windowNavigate === 'function') {
      clerkjs.__internal_windowNavigate(to, opts);
      return;
    }
    if (!inBrowser()) {
      return;
    }
    const allowedProtocols = opts?.useStaticAllowlistOnly
      ? ALLOWED_PROTOCOLS
      : [
          ...ALLOWED_PROTOCOLS,
          ...(this.options.allowedRedirectProtocols ?? [])
        ];
    windowNavigate(to, { allowedProtocols });
  };

  /** clerk-js's module manager, `undefined` until it loads. */
  public get __internal_moduleManager(): ModuleManager | undefined {
    return this.clerkjs?.__internal_moduleManager;
  }

  public get __internal_protectChallengeLoadTimeoutMs(): number | undefined {
    return this.clerkjs?.__internal_protectChallengeLoadTimeoutMs;
  }

  constructor(options: IsomorphicClerkOptions) {
    const { Clerk = null, publishableKey } = options || {};
    this.#publishableKey = publishableKey;
    this.#proxyUrl = options?.proxyUrl;
    this.#domain = options?.domain;
    this.options = options;
    this.Clerk = Clerk;
    this.mode = inBrowser() ? 'browser' : 'server';
    installGlobalPolyfill();
    // Errors loading clerk-js name this package, not @clerk/shared's default.
    setClerkJSLoadingErrorPackageName(PACKAGE_NAME);
    this.#stateProxy = new StateProxy(this);
    // Options can be a Solid props proxy, which ignores writes, so the
    // default is kept here and passed to clerk-js explicitly.
    this.#sdkMetadata = options?.sdkMetadata ?? SDK_METADATA;

    this.#eventBus.emit(clerkEvents.Status, 'loading');
    this.#eventBus.prioritizedOn(
      clerkEvents.Status,
      (status) => (this.#status = status)
    );

    // A Clerk instance the app created carries its own key; a constructor or
    // the CDN build needs one here.
    if (
      this.#publishableKey ||
      (this.Clerk && !isConstructor<BrowserClerkConstructor>(this.Clerk))
    ) {
      void this.loadClerkJS();
    }
  }

  get sdkMetadata(): SDKMetadata {
    return this.clerkjs?.sdkMetadata || this.#sdkMetadata;
  }

  get instanceType() {
    return this.clerkjs?.instanceType;
  }

  get frontendApi() {
    return this.clerkjs?.frontendApi || '';
  }

  get isStandardBrowser() {
    return (
      this.clerkjs?.isStandardBrowser || this.options.standardBrowser || false
    );
  }

  get isSatellite() {
    // This getter can run in environments where window is not available.
    // In those cases we should expect and use domain as a string
    if (typeof window !== 'undefined' && window.location) {
      return handleValueOrFn(
        this.options.isSatellite,
        new URL(window.location.href),
        false
      );
    }
    if (typeof this.options.isSatellite === 'function') {
      return errorThrower.throw(unsupportedNonBrowserDomainOrProxyUrlFunction);
    }
    return false;
  }

  buildSignInUrl = (opts?: RedirectOptions): string | void => {
    const callback = () => this.clerkjs?.buildSignInUrl(opts) || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildSignInUrl', callback);
    }
  };

  buildSignUpUrl = (opts?: RedirectOptions): string | void => {
    const callback = () => this.clerkjs?.buildSignUpUrl(opts) || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildSignUpUrl', callback);
    }
  };

  buildAfterSignInUrl = (
    ...args: Parameters<Clerk['buildAfterSignInUrl']>
  ): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignInUrl(...args) || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignInUrl', callback);
    }
  };

  buildAfterSignUpUrl = (
    ...args: Parameters<Clerk['buildAfterSignUpUrl']>
  ): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignUpUrl(...args) || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignUpUrl', callback);
    }
  };

  buildAfterSignOutUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignOutUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignOutUrl', callback);
    }
  };

  buildAfterMultiSessionSingleSignOutUrl = (): string | void => {
    const callback = () =>
      this.clerkjs?.buildAfterMultiSessionSingleSignOutUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set(
        'buildAfterMultiSessionSingleSignOutUrl',
        callback
      );
    }
  };

  buildUserProfileUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildUserProfileUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildUserProfileUrl', callback);
    }
  };

  buildCreateOrganizationUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildCreateOrganizationUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildCreateOrganizationUrl', callback);
    }
  };

  buildOrganizationProfileUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildOrganizationProfileUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildOrganizationProfileUrl', callback);
    }
  };

  buildWaitlistUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildWaitlistUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildWaitlistUrl', callback);
    }
  };

  buildTasksUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildTasksUrl() || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildTasksUrl', callback);
    }
  };

  setProtectAssertion = (assertion?: ProtectAssertion): void => {
    const callback = () => this.clerkjs?.setProtectAssertion(assertion);
    if (this.clerkjs && this.#loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('setProtectAssertion', callback);
    }
  };

  buildUrlWithAuth = (to: string): string | void => {
    const callback = () => this.clerkjs?.buildUrlWithAuth(to) || '';
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildUrlWithAuth', callback);
    }
  };

  handleUnauthenticated = async () => {
    const callback = () => this.clerkjs?.handleUnauthenticated();
    if (this.clerkjs && this.#loaded) {
      void callback();
    } else {
      this.premountMethodCalls.set('handleUnauthenticated', callback);
    }
  };

  #waitForClerkJS(): Promise<HeadlessBrowserClerk | BrowserClerk> {
    return new Promise<HeadlessBrowserClerk | BrowserClerk>((resolve) => {
      this.addOnLoaded(() => resolve(this.clerkjs!));
    });
  }

  async loadClerkJS(): Promise<
    HeadlessBrowserClerk | BrowserClerk | undefined
  > {
    if (this.mode !== 'browser' || this.#loaded) {
      return;
    }

    // Store frontendAPI value on window as a fallback. This value can be used as a
    // fallback during ClerkJS hot loading in case ClerkJS fails to find the
    // "data-clerk-frontend-api" attribute on its script tag.

    // This can happen when the DOM is altered completely during client rehydration.
    // For example, in Remix with React 18 the document changes completely via `hydrateRoot(document)`.

    // For more information refer to:
    // - https://github.com/remix-run/remix/issues/2947
    // - https://github.com/facebook/react/issues/24430
    if (typeof window !== 'undefined') {
      window.__clerk_publishable_key = this.#publishableKey;
      window.__clerk_proxy_url = this.proxyUrl;
      window.__clerk_domain = this.domain;
    }

    try {
      const clerk = await this.#getClerkJsEntryChunk();

      if (!clerk.loaded) {
        // Clerk Core 3 ships the prebuilt components separately from clerk-js.
        // Load them when the app uses the CDN build, or when it bundles ClerkUI itself.
        const shouldLoadUi =
          (this.options.standardBrowser !== false && !this.Clerk) ||
          !!this.options.ui?.ClerkUI;
        const ClerkUI = shouldLoadUi
          ? await this.#getClerkUIEntryChunk()
          : undefined;
        await clerk.load({
          ...this.options,
          sdkMetadata: this.#sdkMetadata,
          ui: { ...this.options.ui, ClerkUI }
        });
      }

      if (clerk.loaded) {
        return this.hydrateClerkJS(clerk);
      }
      return;
    } catch (err) {
      this.#eventBus.emit(clerkEvents.Status, 'error');
      // loadClerkJS runs fire-and-forget from the constructor, so rethrowing
      // would only surface as an unhandled rejection. Log it like @clerk/react.
      console.error(err instanceof Error ? err.stack || err.message : err);
      return;
    }
  }

  async #getClerkJsEntryChunk(): Promise<HeadlessBrowserClerk | BrowserClerk> {
    // Hot-load clerk-js from the Clerk CDN unless the app passes its own Clerk.
    if (
      (!this.Clerk || this.options.__internal_clerkJSUrl) &&
      !remotelyHostedCodeDisabled() &&
      !globalThis.Clerk
    ) {
      await loadClerkJSScript({
        ...this.options,
        publishableKey: this.#publishableKey,
        proxyUrl: this.proxyUrl,
        domain: this.domain,
        nonce: this.options.nonce
      });
    }

    if (this.Clerk && !this.options.__internal_clerkJSUrl) {
      globalThis.Clerk = isConstructor<
        BrowserClerkConstructor | HeadlessBrowserClerkConstructor
      >(this.Clerk)
        ? new this.Clerk(this.#publishableKey, {
            proxyUrl: this.proxyUrl,
            domain: this.domain
          } as DomainOrProxyUrl)
        : this.Clerk;
    }

    if (!globalThis.Clerk) {
      throw new Error(
        'Failed to download latest ClerkJS. Contact support@clerk.com.'
      );
    }

    return globalThis.Clerk;
  }

  async #getClerkUIEntryChunk(): Promise<ClerkUIConstructor | undefined> {
    const ui = this.options.ui;
    const hasInternalUrl = !!this.options.__internal_clerkUIUrl;

    // A bundled ClerkUI from `@clerk/ui` wins over the CDN.
    if (ui?.ClerkUI && !hasInternalUrl) {
      return ui.ClerkUI;
    }

    // An explicit `ui` prop without ClerkUI, or prefetchUI={false}, opts out of the CDN.
    if ((ui || this.options.prefetchUI === false) && !hasInternalUrl) {
      return undefined;
    }

    if (remotelyHostedCodeDisabled()) {
      return undefined;
    }

    await loadClerkUIScript({
      ...this.options,
      publishableKey: this.#publishableKey,
      proxyUrl: this.proxyUrl,
      domain: this.domain,
      nonce: this.options.nonce
    });

    if (!globalThis.__internal_ClerkUICtor) {
      throw new Error(
        'Failed to download latest Clerk UI. Contact support@clerk.com.'
      );
    }

    return globalThis.__internal_ClerkUICtor;
  }

  /**
   * Subscribes to Clerk events such as `'status'`. Before clerk-js loads,
   * listeners wait here and move to clerk-js once it has loaded.
   */
  public on: Clerk['on'] = (...args) => {
    // A clerk-js without `on` predates the status event.
    if (this.clerkjs?.on) {
      return this.clerkjs.on(...args);
    }
    this.#eventBus.on(...args);
  };

  public off: Clerk['off'] = (...args) => {
    // A listener added before load also stays on this bus, so remove it here
    // too, or it is kept for the instance's lifetime.
    this.#eventBus.off(...args);
    if (this.clerkjs?.off) {
      return this.clerkjs.off(...args);
    }
  };

  public addOnLoaded = (cb: () => void) => {
    this.loadedListeners.push(cb);
    /**
     * When IsomorphicClerk is loaded execute the callback directly
     */
    if (this.loaded) {
      this.emitLoaded();
    }
  };

  public emitLoaded = () => {
    this.loadedListeners.forEach((cb) => cb());
    this.loadedListeners = [];
  };

  private hydrateClerkJS = (
    clerkjs: BrowserClerk | HeadlessBrowserClerk | undefined
  ) => {
    if (!clerkjs) {
      throw new Error('Failed to hydrate latest Clerk JS');
    }

    this.clerkjs = clerkjs;

    this.premountMethodCalls.forEach((cb) => cb());
    this.premountAddListenerCalls.forEach((listenerHandlers, listener) => {
      listenerHandlers.nativeUnsubscribe = clerkjs.addListener(
        listener,
        listenerHandlers.options
      );
    });

    if (this.preopenSignIn !== null) {
      clerkjs.openSignIn(this.preopenSignIn);
    }

    if (this.preopenSignUp !== null) {
      clerkjs.openSignUp(this.preopenSignUp);
    }

    if (this.preopenUserProfile !== null) {
      clerkjs.openUserProfile(this.preopenUserProfile);
    }

    if (this.preopenUserVerification !== null) {
      clerkjs.__internal_openReverification(this.preopenUserVerification);
    }

    if (this.preopenOneTap !== null) {
      clerkjs.openGoogleOneTap(this.preopenOneTap);
    }

    if (this.preopenOrganizationProfile !== null) {
      clerkjs.openOrganizationProfile(this.preopenOrganizationProfile);
    }

    if (this.preopenCreateOrganization !== null) {
      clerkjs.openCreateOrganization(this.preopenCreateOrganization);
    }

    if (this.preOpenWaitlist !== null) {
      clerkjs.openWaitlist(this.preOpenWaitlist);
    }

    if (this.preopenInviteMembers !== null) {
      clerkjs.openInviteMembers(this.preopenInviteMembers);
    }

    if (this.preopenEnableOrganizationsPrompt) {
      clerkjs.__internal_openEnableOrganizationsPrompt(
        this.preopenEnableOrganizationsPrompt
      );
    }

    this.premountSignInNodes.forEach((props, node) => {
      clerkjs.mountSignIn(node, props);
    });

    this.premountSignUpNodes.forEach((props, node) => {
      clerkjs.mountSignUp(node, props);
    });

    this.premountUserProfileNodes.forEach((props, node) => {
      clerkjs.mountUserProfile(node, props);
    });

    this.premountUserButtonNodes.forEach((props, node) => {
      clerkjs.mountUserButton(node, props);
    });

    this.premountOrganizationProfileNodes.forEach((props, node) => {
      clerkjs.mountOrganizationProfile(node, props);
    });

    this.premountCreateOrganizationNodes.forEach((props, node) => {
      clerkjs.mountCreateOrganization(node, props);
    });

    this.premountOrganizationSwitcherNodes.forEach((props, node) => {
      clerkjs.mountOrganizationSwitcher(node, props);
    });

    this.premountOrganizationListNodes.forEach((props, node) => {
      clerkjs.mountOrganizationList(node, props);
    });

    this.premountWaitlistNodes.forEach((props, node) => {
      clerkjs.mountWaitlist(node, props);
    });

    this.premountPricingTableNodes.forEach((props, node) => {
      clerkjs.mountPricingTable(node, props);
    });

    this.premountUserAvatarNodes.forEach((props, node) => {
      clerkjs.mountUserAvatar(node, props);
    });

    this.premountAPIKeysNodes.forEach((props, node) => {
      clerkjs.mountAPIKeys(node, props);
    });

    this.premountConfigureSSONodes.forEach((props, node) => {
      clerkjs.__internal_mountConfigureSSO(node, props);
    });

    // An older clerk-js has no directory sync or device verification.
    if (typeof clerkjs.__internal_mountConfigureDirectorySync === 'function') {
      this.premountConfigureDirectorySyncNodes.forEach((props, node) => {
        clerkjs.__internal_mountConfigureDirectorySync(node, props);
      });
    }

    this.premountOAuthConsentNodes.forEach((props, node) => {
      clerkjs.__internal_mountOAuthConsent(node, props);
    });

    if (typeof clerkjs.__internal_mountOAuthDeviceVerification === 'function') {
      this.premountOAuthDeviceVerificationNodes.forEach((props, node) => {
        clerkjs.__internal_mountOAuthDeviceVerification(node, props);
      });
    }

    this.premountTaskChooseOrganizationNodes.forEach((props, node) => {
      clerkjs.mountTaskChooseOrganization(node, props);
    });

    this.premountTaskResetPasswordNodes.forEach((props, node) => {
      clerkjs.mountTaskResetPassword(node, props);
    });

    this.premountTaskSetupMFANodes.forEach((props, node) => {
      clerkjs.mountTaskSetupMFA(node, props);
    });

    this.#loaded = true;

    // Status listeners move to clerk-js, which now owns the status, and
    // `notify` hands them its current value. This runs after `loaded` is set,
    // so a listener that sees `'ready'` can use this instance right away.
    if (typeof clerkjs.on === 'function') {
      // The bus returns its live array, which off() splices. Walk a copy, so
      // a listener removing itself does not make this skip the next one, and
      // skip any listener an earlier notification has removed (a disposed
      // <ClerkLoading>, say), so it is not subscribed again.
      const live =
        this.#eventBus.internal.retrieveListeners(clerkEvents.Status) ?? [];
      [...live].forEach((listener) => {
        if (!live.includes(listener)) return;
        clerkjs.on(clerkEvents.Status, listener, { notify: true });
      });
    }
    // A clerk-js without `status` predates the status event, so report
    // `'ready'` to the listeners that stayed here.
    if (typeof clerkjs.status === 'undefined') {
      this.#eventBus.emit(clerkEvents.Status, 'ready');
    }
    this.emitLoaded();
    return this.clerkjs;
  };

  get version() {
    return this.clerkjs?.version;
  }

  get uiVersion(): string | undefined {
    return this.clerkjs?.uiVersion;
  }

  get client(): ClientResource | undefined {
    if (this.clerkjs) {
      return this.clerkjs.client;
      // TODO: add ssr condition
    } else {
      return undefined;
    }
  }

  get session() {
    if (this.clerkjs) {
      return this.clerkjs.session;
    } else {
      return undefined;
    }
  }

  get user() {
    if (this.clerkjs) {
      return this.clerkjs.user;
    } else {
      return undefined;
    }
  }

  get organization() {
    if (this.clerkjs) {
      return this.clerkjs.organization;
    } else {
      return undefined;
    }
  }

  get telemetry() {
    if (this.clerkjs) {
      return this.clerkjs.telemetry;
    } else {
      return undefined;
    }
  }

  get __internal_environment(): EnvironmentResource | null | undefined {
    return this.#clerkjsInternals?.__internal_environment;
  }

  get isSignedIn(): boolean {
    if (this.clerkjs) {
      return this.clerkjs.isSignedIn;
    } else {
      return false;
    }
  }

  /**
   * The signals behind the Core 3 `useSignIn`, `useSignUp` and
   * `useWaitlist`: clerk-js's once it has loaded, and a stand-in with
   * defaults before that and on the server.
   */
  get __internal_state(): State {
    return this.#loaded && this.clerkjs
      ? this.clerkjs.__internal_state
      : this.#stateProxy;
  }

  get apiKeys(): APIKeysNamespace | undefined {
    return this.clerkjs?.apiKeys;
  }

  get oauthApplication(): OAuthApplicationNamespace | undefined {
    return this.clerkjs?.oauthApplication;
  }

  get __internal_lastEmittedResources(): Resources | undefined {
    return this.clerkjs?.__internal_lastEmittedResources;
  }

  get __internal_hasOAuthTransport(): boolean {
    return this.clerkjs?.__internal_hasOAuthTransport || false;
  }

  get __internal_oauthTransport() {
    return this.clerkjs?.__internal_oauthTransport || null;
  }

  get __internal_country(): string | null | undefined {
    return this.clerkjs?.__internal_country;
  }

  __internal_setEnvironment = (
    env: EnvironmentJSON
  ): Promise<void> | undefined => {
    return this.#clerkjsInternals?.__internal_setEnvironment?.(env);
  };

  /**
   * Sends new props to a mounted component (`{ node, props }`) or new
   * `appearance`/`options` to clerk-js. Waits until clerk-js has loaded.
   */
  __internal_updateProps = async (props: any): Promise<void> => {
    await this.#waitForClerkJS();
    const updateProps = this.#clerkjsInternals?.__internal_updateProps;
    if (typeof updateProps === 'function') {
      return updateProps(props);
    }
    // A clerk-js without this method would drop every prop change silently.
    if (!this.#warnedMissingUpdateProps) {
      this.#warnedMissingUpdateProps = true;
      logErrorInDevMode(
        `${PACKAGE_NAME}: the loaded clerk-js has no __internal_updateProps, so prop changes cannot reach Clerk's components. Load clerk-js 6 or later.`
      );
    }
  };

  #warnedMissingUpdateProps = false;

  get #clerkjsInternals(): Partial<ClerkJSInternals> | null {
    return this.clerkjs as Partial<ClerkJSInternals> | null;
  }

  /**
   * `setActive` can be used to set the active session and/or organization.
   */
  setActive = (params: SetActiveParams): Promise<void> => {
    if (this.clerkjs) {
      return this.clerkjs.setActive(params);
    } else {
      return Promise.reject();
    }
  };

  openSignIn = (props?: SignInProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openSignIn(props);
    } else {
      this.preopenSignIn = props;
    }
  };

  closeSignIn = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeSignIn();
    } else {
      this.preopenSignIn = null;
    }
  };

  __internal_openReverification = (
    props?: __internal_UserVerificationModalProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_openReverification(props);
    } else {
      this.preopenUserVerification = props;
    }
  };

  __internal_closeReverification = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_closeReverification();
    } else {
      this.preopenUserVerification = null;
    }
  };

  openGoogleOneTap = (props?: GoogleOneTapProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openGoogleOneTap(props);
    } else {
      this.preopenOneTap = props;
    }
  };

  closeGoogleOneTap = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeGoogleOneTap();
    } else {
      this.preopenOneTap = null;
    }
  };

  openUserProfile = (props?: UserProfileProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openUserProfile(props);
    } else {
      this.preopenUserProfile = props;
    }
  };

  closeUserProfile = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeUserProfile();
    } else {
      this.preopenUserProfile = null;
    }
  };

  openOrganizationProfile = (props?: OrganizationProfileProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openOrganizationProfile(props);
    } else {
      this.preopenOrganizationProfile = props;
    }
  };

  closeOrganizationProfile = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeOrganizationProfile();
    } else {
      this.preopenOrganizationProfile = null;
    }
  };

  openCreateOrganization = (props?: CreateOrganizationProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openCreateOrganization(props);
    } else {
      this.preopenCreateOrganization = props;
    }
  };

  closeCreateOrganization = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeCreateOrganization();
    } else {
      this.preopenCreateOrganization = null;
    }
  };

  openWaitlist = (props?: WaitlistProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openWaitlist(props);
    } else {
      this.preOpenWaitlist = props;
    }
  };

  closeWaitlist = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeWaitlist();
    } else {
      this.preOpenWaitlist = null;
    }
  };

  openInviteMembers = (props?: InviteMembersModalProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openInviteMembers(props);
    } else {
      this.preopenInviteMembers = props;
    }
  };

  closeInviteMembers = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeInviteMembers();
    } else {
      this.preopenInviteMembers = null;
    }
  };

  __internal_openEnableOrganizationsPrompt = (
    props: __internal_EnableOrganizationsPromptProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_openEnableOrganizationsPrompt(props);
    } else {
      this.preopenEnableOrganizationsPrompt = props;
    }
  };

  __internal_closeEnableOrganizationsPrompt = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_closeEnableOrganizationsPrompt();
    } else {
      this.preopenEnableOrganizationsPrompt = null;
    }
  };

  __internal_attemptToEnableEnvironmentSetting = (
    options: __internal_AttemptToEnableEnvironmentSettingParams
  ): __internal_AttemptToEnableEnvironmentSettingResult | void => {
    // Optional: replaying the queue must not throw on a clerk-js without it.
    const callback = () =>
      this.clerkjs?.__internal_attemptToEnableEnvironmentSetting?.(options);
    if (this.clerkjs && this.#loaded) {
      return callback() as __internal_AttemptToEnableEnvironmentSettingResult;
    } else {
      this.premountMethodCalls.set(
        '__internal_attemptToEnableEnvironmentSetting',
        callback
      );
    }
  };

  openSignUp = (props?: SignUpProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.openSignUp(props);
    } else {
      this.preopenSignUp = props;
    }
  };

  closeSignUp = () => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.closeSignUp();
    } else {
      this.preopenSignUp = null;
    }
  };

  mountSignIn = (node: HTMLDivElement, props?: SignInProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountSignIn(node, props);
    } else {
      this.premountSignInNodes.set(node, props);
    }
  };

  unmountSignIn = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountSignIn(node);
    } else {
      this.premountSignInNodes.delete(node);
    }
  };

  mountPricingTable = (node: HTMLDivElement, props?: PricingTableProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountPricingTable(node, props);
    } else {
      this.premountPricingTableNodes.set(node, props);
    }
  };

  unmountPricingTable = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountPricingTable(node);
    } else {
      this.premountPricingTableNodes.delete(node);
    }
  };

  mountSignUp = (node: HTMLDivElement, props?: SignUpProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountSignUp(node, props);
    } else {
      this.premountSignUpNodes.set(node, props);
    }
  };

  unmountSignUp = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountSignUp(node);
    } else {
      this.premountSignUpNodes.delete(node);
    }
  };

  mountUserProfile = (node: HTMLDivElement, props?: UserProfileProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountUserProfile(node, props);
    } else {
      this.premountUserProfileNodes.set(node, props);
    }
  };

  unmountUserProfile = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountUserProfile(node);
    } else {
      this.premountUserProfileNodes.delete(node);
    }
  };

  mountOrganizationProfile = (
    node: HTMLDivElement,
    props?: OrganizationProfileProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountOrganizationProfile(node, props);
    } else {
      this.premountOrganizationProfileNodes.set(node, props);
    }
  };

  unmountOrganizationProfile = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountOrganizationProfile(node);
    } else {
      this.premountOrganizationProfileNodes.delete(node);
    }
  };

  mountCreateOrganization = (
    node: HTMLDivElement,
    props?: CreateOrganizationProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountCreateOrganization(node, props);
    } else {
      this.premountCreateOrganizationNodes.set(node, props);
    }
  };

  unmountCreateOrganization = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountCreateOrganization(node);
    } else {
      this.premountCreateOrganizationNodes.delete(node);
    }
  };

  mountOrganizationSwitcher = (
    node: HTMLDivElement,
    props?: OrganizationSwitcherProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountOrganizationSwitcher(node, props);
    } else {
      this.premountOrganizationSwitcherNodes.set(node, props);
    }
  };

  unmountOrganizationSwitcher = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountOrganizationSwitcher(node);
    } else {
      this.premountOrganizationSwitcherNodes.delete(node);
    }
  };

  __experimental_prefetchOrganizationSwitcher = () => {
    const callback = () =>
      this.clerkjs?.__experimental_prefetchOrganizationSwitcher();
    if (this.clerkjs && this.#loaded) {
      void callback();
    } else {
      this.premountMethodCalls.set(
        '__experimental_prefetchOrganizationSwitcher',
        callback
      );
    }
  };

  mountOrganizationList = (
    node: HTMLDivElement,
    props?: OrganizationListProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountOrganizationList(node, props);
    } else {
      this.premountOrganizationListNodes.set(node, props);
    }
  };

  unmountOrganizationList = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountOrganizationList(node);
    } else {
      this.premountOrganizationListNodes.delete(node);
    }
  };

  mountUserButton = (
    node: HTMLDivElement,
    userButtonProps?: UserButtonProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountUserButton(node, userButtonProps);
    } else {
      this.premountUserButtonNodes.set(node, userButtonProps);
    }
  };

  unmountUserButton = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountUserButton(node);
    } else {
      this.premountUserButtonNodes.delete(node);
    }
  };

  mountWaitlist = (node: HTMLDivElement, props?: WaitlistProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountWaitlist(node, props);
    } else {
      this.premountWaitlistNodes.set(node, props);
    }
  };

  unmountWaitlist = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountWaitlist(node);
    } else {
      this.premountWaitlistNodes.delete(node);
    }
  };

  mountUserAvatar = (node: HTMLDivElement, props?: UserAvatarProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountUserAvatar(node, props);
    } else {
      this.premountUserAvatarNodes.set(node, props);
    }
  };

  unmountUserAvatar = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountUserAvatar(node);
    } else {
      this.premountUserAvatarNodes.delete(node);
    }
  };

  mountAPIKeys = (node: HTMLDivElement, props?: APIKeysProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountAPIKeys(node, props);
    } else {
      this.premountAPIKeysNodes.set(node, props);
    }
  };

  unmountAPIKeys = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountAPIKeys(node);
    } else {
      this.premountAPIKeysNodes.delete(node);
    }
  };

  __internal_mountConfigureSSO = (
    node: HTMLDivElement,
    props?: ConfigureSSOProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_mountConfigureSSO(node, props);
    } else {
      this.premountConfigureSSONodes.set(node, props);
    }
  };

  __internal_unmountConfigureSSO = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_unmountConfigureSSO(node);
    } else {
      this.premountConfigureSSONodes.delete(node);
    }
  };

  __internal_mountConfigureDirectorySync = (
    node: HTMLDivElement,
    props?: ConfigureSSOProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      // An older clerk-js has no directory sync.
      if (
        typeof this.clerkjs.__internal_mountConfigureDirectorySync ===
        'function'
      ) {
        this.clerkjs.__internal_mountConfigureDirectorySync(node, props);
      }
    } else {
      this.premountConfigureDirectorySyncNodes.set(node, props);
    }
  };

  __internal_unmountConfigureDirectorySync = (node: HTMLDivElement) => {
    if (
      this.clerkjs &&
      this.#loaded &&
      typeof this.clerkjs.__internal_unmountConfigureDirectorySync ===
        'function'
    ) {
      this.clerkjs.__internal_unmountConfigureDirectorySync(node);
    }
    this.premountConfigureDirectorySyncNodes.delete(node);
  };

  __internal_mountOAuthConsent = (
    node: HTMLDivElement,
    props?: OAuthConsentProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_mountOAuthConsent(node, props);
    } else {
      this.premountOAuthConsentNodes.set(node, props);
    }
  };

  __internal_unmountOAuthConsent = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.__internal_unmountOAuthConsent(node);
    } else {
      this.premountOAuthConsentNodes.delete(node);
    }
  };

  mountOAuthConsent = (node: HTMLDivElement, props?: OAuthConsentProps) => {
    this.__internal_mountOAuthConsent(node, props);
  };

  unmountOAuthConsent = (node: HTMLDivElement) => {
    this.__internal_unmountOAuthConsent(node);
  };

  __internal_mountOAuthDeviceVerification = (
    node: HTMLDivElement,
    props?: OAuthDeviceVerificationProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      // An older clerk-js has no device verification.
      if (
        typeof this.clerkjs.__internal_mountOAuthDeviceVerification ===
        'function'
      ) {
        this.clerkjs.__internal_mountOAuthDeviceVerification(node, props);
      }
    } else {
      this.premountOAuthDeviceVerificationNodes.set(node, props);
    }
  };

  __internal_unmountOAuthDeviceVerification = (node: HTMLDivElement) => {
    if (
      this.clerkjs &&
      this.#loaded &&
      typeof this.clerkjs.__internal_unmountOAuthDeviceVerification ===
        'function'
    ) {
      this.clerkjs.__internal_unmountOAuthDeviceVerification(node);
    }
    this.premountOAuthDeviceVerificationNodes.delete(node);
  };

  mountTaskChooseOrganization = (
    node: HTMLDivElement,
    props?: TaskChooseOrganizationProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountTaskChooseOrganization(node, props);
    } else {
      this.premountTaskChooseOrganizationNodes.set(node, props);
    }
  };

  unmountTaskChooseOrganization = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountTaskChooseOrganization(node);
    } else {
      this.premountTaskChooseOrganizationNodes.delete(node);
    }
  };

  mountTaskResetPassword = (
    node: HTMLDivElement,
    props?: TaskResetPasswordProps
  ) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountTaskResetPassword(node, props);
    } else {
      this.premountTaskResetPasswordNodes.set(node, props);
    }
  };

  unmountTaskResetPassword = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountTaskResetPassword(node);
    } else {
      this.premountTaskResetPasswordNodes.delete(node);
    }
  };

  mountTaskSetupMFA = (node: HTMLDivElement, props?: TaskSetupMFAProps) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.mountTaskSetupMFA(node, props);
    } else {
      this.premountTaskSetupMFANodes.set(node, props);
    }
  };

  unmountTaskSetupMFA = (node: HTMLDivElement) => {
    if (this.clerkjs && this.#loaded) {
      this.clerkjs.unmountTaskSetupMFA(node);
    } else {
      this.premountTaskSetupMFANodes.delete(node);
    }
  };

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
    if (this.clerkjs && this.#loaded) {
      void callback();
    } else {
      this.premountMethodCalls.set('navigate', callback);
    }
  };

  redirectWithAuth = async (...args: Parameters<Clerk['redirectWithAuth']>) => {
    const callback = () => this.clerkjs?.redirectWithAuth(...args);
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectWithAuth', callback);
      return;
    }
  };

  redirectToSignIn = async (opts?: SignInRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToSignIn(opts as any);
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToSignIn', callback);
      return;
    }
  };

  redirectToSignUp = async (opts?: SignUpRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToSignUp(opts as any);
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToSignUp', callback);
      return;
    }
  };

  redirectToUserProfile = async () => {
    const callback = () => this.clerkjs?.redirectToUserProfile();
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToUserProfile', callback);
      return;
    }
  };

  redirectToAfterSignUp = (): void => {
    const callback = () => this.clerkjs?.redirectToAfterSignUp();
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignUp', callback);
    }
  };

  redirectToAfterSignIn = () => {
    const callback = () => this.clerkjs?.redirectToAfterSignIn();
    if (this.clerkjs && this.#loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignIn', callback);
    }
  };

  redirectToAfterSignOut = () => {
    const callback = () => this.clerkjs?.redirectToAfterSignOut();
    if (this.clerkjs && this.#loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('redirectToAfterSignOut', callback);
    }
  };

  redirectToOrganizationProfile = async () => {
    const callback = () => this.clerkjs?.redirectToOrganizationProfile();
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToOrganizationProfile', callback);
      return;
    }
  };

  redirectToCreateOrganization = async () => {
    const callback = () => this.clerkjs?.redirectToCreateOrganization();
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToCreateOrganization', callback);
      return;
    }
  };

  redirectToWaitlist = async () => {
    const callback = () => this.clerkjs?.redirectToWaitlist();
    if (this.clerkjs && this.#loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('redirectToWaitlist', callback);
      return;
    }
  };

  redirectToTasks = async (opts?: TasksRedirectOptions) => {
    const callback = () => this.clerkjs?.redirectToTasks(opts);
    if (this.clerkjs && this.#loaded) {
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
    if (this.clerkjs && this.#loaded) {
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
    if (this.clerkjs && this.#loaded) {
      return callback();
    }
    this.premountMethodCalls.set('__internal_handleResourceCallback', callback);
    return;
  };

  handleRedirectCallback = async (
    params: HandleOAuthCallbackParams
  ): Promise<void> => {
    const callback = () => this.clerkjs?.handleRedirectCallback(params);
    if (this.clerkjs && this.#loaded) {
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
    if (this.clerkjs && this.#loaded) {
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
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('handleEmailLinkVerification', callback);
    }
  };

  authenticateWithMetamask = async (
    params?: AuthenticateWithMetamaskParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithMetamask(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithMetamask', callback);
    }
  };

  authenticateWithCoinbaseWallet = async (
    params?: AuthenticateWithCoinbaseWalletParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithCoinbaseWallet(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithCoinbaseWallet', callback);
    }
  };

  authenticateWithOKXWallet = async (
    params?: AuthenticateWithOKXWalletParams
  ) => {
    const callback = () => this.clerkjs?.authenticateWithOKXWallet(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithOKXWallet', callback);
    }
  };

  authenticateWithBase = async (params?: AuthenticateWithBaseParams) => {
    const callback = () => this.clerkjs?.authenticateWithBase(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithBase', callback);
    }
  };

  authenticateWithSolana = async (params: AuthenticateWithSolanaParams) => {
    const callback = () => this.clerkjs?.authenticateWithSolana(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithSolana', callback);
    }
  };

  authenticateWithWeb3 = async (params: ClerkAuthenticateWithWeb3Params) => {
    const callback = () => this.clerkjs?.authenticateWithWeb3(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('authenticateWithWeb3', callback);
    }
  };

  authenticateWithGoogleOneTap = async (
    params: AuthenticateWithGoogleOneTapParams
  ) => {
    const clerkjs = await this.#waitForClerkJS();
    return clerkjs.authenticateWithGoogleOneTap(params);
  };

  createOrganization = async (
    params: CreateOrganizationParams
  ): Promise<OrganizationResource | void> => {
    const callback = () => this.clerkjs?.createOrganization(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<OrganizationResource>;
    } else {
      this.premountMethodCalls.set('createOrganization', callback);
    }
  };

  getOrganization = async (
    organizationId: string
  ): Promise<OrganizationResource | void> => {
    const callback = () => this.clerkjs?.getOrganization(organizationId);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<OrganizationResource>;
    } else {
      this.premountMethodCalls.set('getOrganization', callback);
    }
  };

  joinWaitlist = async (
    params: JoinWaitlistParams
  ): Promise<WaitlistResource | void> => {
    const callback = () => this.clerkjs?.joinWaitlist(params);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<WaitlistResource>;
    } else {
      this.premountMethodCalls.set('joinWaitlist', callback);
    }
  };

  signOut = async (...args: Parameters<Clerk['signOut']>) => {
    const callback = () => this.clerkjs?.signOut(...args);
    if (this.clerkjs && this.#loaded) {
      return callback() as Promise<void>;
    } else {
      this.premountMethodCalls.set('signOut', callback);
    }
  };
}
