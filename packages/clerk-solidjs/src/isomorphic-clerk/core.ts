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
  Clerk,
  ClerkOptions,
  ClerkStatus,
  ClerkUIConstructor,
  DomainOrProxyUrl,
  SDKMetadata
} from '@clerk/shared/types';
import { handleValueOrFn } from '@clerk/shared/utils';

import { errorThrower } from '../errors/error-thrower';
import { unsupportedNonBrowserDomainOrProxyUrlFunction } from '../errors/messages';
import { installGlobalPolyfill } from '../polyfills';
import type {
  BrowserClerk,
  BrowserClerkConstructor,
  ClerkProp,
  HeadlessBrowserClerk,
  HeadlessBrowserClerkConstructor,
  IsomorphicClerkOptions
} from '../types';
import { isConstructor } from '../utils';

import { IsomorphicClerkQueue } from './queue';

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

export abstract class IsomorphicClerkCore extends IsomorphicClerkQueue {
  private readonly mode: 'browser' | 'server';
  private readonly options: IsomorphicClerkOptions;
  protected readonly Clerk: ClerkProp;
  private loadedListeners: Array<() => void> = [];

  #loaded = false;
  #status: ClerkStatus = 'loading';
  #eventBus = createClerkEventBus();
  #domain: DomainOrProxyUrl['domain'];
  #proxyUrl: DomainOrProxyUrl['proxyUrl'];
  #publishableKey: string;
  #sdkMetadata: SDKMetadata;

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
    super();
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
    // Options can be a Solid props proxy, which ignores writes, so the
    // default is kept here and passed to clerk-js explicitly.
    this.#sdkMetadata = options?.sdkMetadata ?? SDK_METADATA;

    this.#eventBus.emit(clerkEvents.Status, 'loading');
    this.#eventBus.prioritizedOn(
      clerkEvents.Status,
      (status) => (this.#status = status)
    );
  }

  /**
   * Starts loading clerk-js. `IsomorphicClerk`'s constructor calls this once
   * every member exists, as the single class's constructor did.
   */
  protected startLoading(): void {
    if (
      // An instance carries its own key. A constructor without one throws
      // in #loadHeadlessClerk, which reports a failed load.
      this.Clerk &&
      (this.options.experimental as { runtimeEnvironment?: string } | undefined)
        ?.runtimeEnvironment === 'headless'
    ) {
      void this.#loadHeadlessClerk();
    } else if (
      // A Clerk instance the app created carries its own key; a constructor
      // or the CDN build needs one here.
      this.#publishableKey ||
      (this.Clerk && !isConstructor<BrowserClerkConstructor>(this.Clerk))
    ) {
      void this.loadClerkJS();
    }
  }

  /**
   * Loads the Clerk instance or constructor the app passed, in any runtime,
   * for `experimental: { runtimeEnvironment: 'headless' }`: no script, no UI
   * and no window globals, as @clerk/react's `loadHeadlessClerk`. If it
   * fails, the status is `error` and `addOnLoaded` callbacks still run.
   */
  async #loadHeadlessClerk(): Promise<void> {
    try {
      // Inside the try: a constructor that throws is a failed load too.
      const clerk = isConstructor<
        BrowserClerkConstructor | HeadlessBrowserClerkConstructor
      >(this.Clerk)
        ? new this.Clerk(this.#publishableKey, {
            proxyUrl: this.proxyUrl,
            domain: this.domain
          } as DomainOrProxyUrl)
        : this.Clerk;

      if (!clerk) {
        this.#eventBus.emit(clerkEvents.Status, 'error');
        return;
      }

      if (!clerk.loaded) {
        await clerk.load({ ...this.options, sdkMetadata: this.#sdkMetadata });
      }
      this.hydrateClerkJS(clerk);
    } catch (err) {
      if (__DEV__) {
        console.error('Clerk: Failed to load:', err);
      }
      this.#eventBus.emit(clerkEvents.Status, 'error');
      this.emitLoaded();
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

  protected waitForClerkJS(): Promise<HeadlessBrowserClerk | BrowserClerk> {
    // Once loaded, resolve here: addOnLoaded would run emitLoaded() again,
    // re-entering the loaded listener that called this, if one did.
    if (this.clerkjs && this.loaded) {
      return Promise.resolve(this.clerkjs);
    }
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

    this.replayQueuedCalls(clerkjs);

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
}
