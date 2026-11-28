import type {
  __experimental_CheckoutOptions,
  APIKeysNamespace,
  BillingNamespace,
  CheckoutSignalValue,
  Clerk,
  ClientResource,
  EnvironmentJSON,
  EnvironmentResource,
  OAuthApplicationNamespace,
  ProtectAssertion,
  RedirectOptions,
  Resources,
  SetActiveParams,
  State
} from '@clerk/shared/types';
import { logErrorInDevMode } from '@clerk/shared/utils';

import { StateProxy } from '../state-proxy';
import type { ClerkJSInternals } from '../types';

import type { IsomorphicClerk } from '../isomorphic-clerk';
import { IsomorphicClerkCore } from './core';

/** The URL builders, the resources clerk-js holds, and `setActive`. */
export abstract class IsomorphicClerkResources extends IsomorphicClerkCore {
  // Created after the core constructor, as before: a stand-in until load.
  #stateProxy = new StateProxy(this as unknown as IsomorphicClerk);

  buildSignInUrl = (opts?: RedirectOptions): string | void => {
    const callback = () => this.clerkjs?.buildSignInUrl(opts) || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildSignInUrl', callback);
    }
  };

  buildSignUpUrl = (opts?: RedirectOptions): string | void => {
    const callback = () => this.clerkjs?.buildSignUpUrl(opts) || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildSignUpUrl', callback);
    }
  };

  buildAfterSignInUrl = (
    ...args: Parameters<Clerk['buildAfterSignInUrl']>
  ): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignInUrl(...args) || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignInUrl', callback);
    }
  };

  buildAfterSignUpUrl = (
    ...args: Parameters<Clerk['buildAfterSignUpUrl']>
  ): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignUpUrl(...args) || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignUpUrl', callback);
    }
  };

  buildAfterSignOutUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildAfterSignOutUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildAfterSignOutUrl', callback);
    }
  };

  buildAfterMultiSessionSingleSignOutUrl = (): string | void => {
    const callback = () =>
      this.clerkjs?.buildAfterMultiSessionSingleSignOutUrl() || '';
    if (this.clerkjs && this.loaded) {
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
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildUserProfileUrl', callback);
    }
  };

  buildCreateOrganizationUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildCreateOrganizationUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildCreateOrganizationUrl', callback);
    }
  };

  buildOrganizationProfileUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildOrganizationProfileUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildOrganizationProfileUrl', callback);
    }
  };

  buildWaitlistUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildWaitlistUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildWaitlistUrl', callback);
    }
  };

  buildNewSubscriptionRedirectUrl = (): string | void => {
    const callback = () =>
      this.clerkjs?.buildNewSubscriptionRedirectUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildNewSubscriptionRedirectUrl', callback);
    }
  };

  buildTasksUrl = (): string | void => {
    const callback = () => this.clerkjs?.buildTasksUrl() || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildTasksUrl', callback);
    }
  };

  setProtectAssertion = (assertion?: ProtectAssertion): void => {
    const callback = () => this.clerkjs?.setProtectAssertion(assertion);
    if (this.clerkjs && this.loaded) {
      callback();
    } else {
      this.premountMethodCalls.set('setProtectAssertion', callback);
    }
  };

  buildUrlWithAuth = (to: string): string | void => {
    const callback = () => this.clerkjs?.buildUrlWithAuth(to) || '';
    if (this.clerkjs && this.loaded) {
      return callback();
    } else {
      this.premountMethodCalls.set('buildUrlWithAuth', callback);
    }
  };

  handleUnauthenticated = async () => {
    const callback = () => this.clerkjs?.handleUnauthenticated();
    if (this.clerkjs && this.loaded) {
      void callback();
    } else {
      this.premountMethodCalls.set('handleUnauthenticated', callback);
    }
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
    return this.loaded && this.clerkjs
      ? this.clerkjs.__internal_state
      : this.#stateProxy;
  }

  get billing(): BillingNamespace | undefined {
    return this.clerkjs?.billing;
  }

  /**
   * A checkout's signal: clerk-js's once it has loaded, and the stand-in's
   * defaults before that and on the server.
   */
  __experimental_checkout = (
    options: __experimental_CheckoutOptions
  ): CheckoutSignalValue =>
    this.loaded && this.clerkjs
      ? this.clerkjs.__experimental_checkout(options)
      : this.#stateProxy.checkoutSignal(options);

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
    await this.waitForClerkJS();
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
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Rejects with undefined today; an Error would change what callers catch.
      return Promise.reject();
    }
  };
}
