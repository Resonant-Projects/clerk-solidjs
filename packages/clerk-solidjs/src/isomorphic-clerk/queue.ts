import type {
  __internal_CheckoutProps,
  __internal_EnableOrganizationsPromptProps,
  __internal_PlanDetailsProps,
  __internal_SubscriptionDetailsProps,
  __internal_UserVerificationProps,
  APIKeysProps,
  ConfigureSSOProps,
  CreateOrganizationProps,
  GoogleOneTapProps,
  InviteMembersModalProps,
  ListenerCallback,
  ListenerOptions,
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
  UnsubscribeCallback,
  UserAvatarProps,
  UserButtonProps,
  UserProfileProps,
  WaitlistProps
} from '@clerk/shared/types';

import type { BrowserClerk, HeadlessBrowserClerk } from '../types';

type GenericFunction<TArgs = never> = (...args: TArgs[]) => unknown;

type MethodName<T> = {
  [P in keyof T]: T[P] extends GenericFunction ? P : never;
}[keyof T];

type MethodCallback = () => Promise<unknown> | unknown;

/**
 * What an `IsomorphicClerk` holds for clerk-js before it loads: the modals
 * opened, the components mounted and the calls made, replayed into clerk-js
 * once it has loaded.
 */
export abstract class IsomorphicClerkQueue {
  protected clerkjs: BrowserClerk | HeadlessBrowserClerk | null = null;
  protected preopenOneTap?: null | GoogleOneTapProps = null;
  protected preopenUserVerification?: null | __internal_UserVerificationProps =
    null;
  protected preopenSignIn?: null | SignInProps = null;
  protected preopenSignUp?: null | SignUpProps = null;
  protected preopenUserProfile?: null | UserProfileProps = null;
  protected preopenOrganizationProfile?: null | OrganizationProfileProps = null;
  protected preopenCreateOrganization?: null | CreateOrganizationProps = null;
  protected preOpenWaitlist?: null | WaitlistProps = null;
  protected preopenInviteMembers?: null | InviteMembersModalProps = null;
  protected preopenEnableOrganizationsPrompt?: null | __internal_EnableOrganizationsPromptProps =
    null;
  protected preopenCheckout?: null | __internal_CheckoutProps = null;
  protected preopenPlanDetails: null | __internal_PlanDetailsProps = null;
  protected preopenSubscriptionDetails: null | __internal_SubscriptionDetailsProps =
    null;
  protected premountSignInNodes = new Map<
    HTMLDivElement,
    SignInProps | undefined
  >();
  protected premountSignUpNodes = new Map<
    HTMLDivElement,
    SignUpProps | undefined
  >();
  protected premountUserProfileNodes = new Map<
    HTMLDivElement,
    UserProfileProps | undefined
  >();
  protected premountUserButtonNodes = new Map<
    HTMLDivElement,
    UserButtonProps | undefined
  >();
  protected premountOrganizationProfileNodes = new Map<
    HTMLDivElement,
    OrganizationProfileProps | undefined
  >();
  protected premountCreateOrganizationNodes = new Map<
    HTMLDivElement,
    CreateOrganizationProps | undefined
  >();
  protected premountOrganizationSwitcherNodes = new Map<
    HTMLDivElement,
    OrganizationSwitcherProps | undefined
  >();
  protected premountOrganizationListNodes = new Map<
    HTMLDivElement,
    OrganizationListProps | undefined
  >();
  protected premountMethodCalls = new Map<
    MethodName<BrowserClerk>,
    MethodCallback
  >();
  protected premountWaitlistNodes = new Map<
    HTMLDivElement,
    WaitlistProps | undefined
  >();
  protected premountPricingTableNodes = new Map<
    HTMLDivElement,
    PricingTableProps | undefined
  >();
  protected premountUserAvatarNodes = new Map<
    HTMLDivElement,
    UserAvatarProps | undefined
  >();
  protected premountAPIKeysNodes = new Map<
    HTMLDivElement,
    APIKeysProps | undefined
  >();
  protected premountConfigureSSONodes = new Map<
    HTMLDivElement,
    ConfigureSSOProps | undefined
  >();
  protected premountConfigureDirectorySyncNodes = new Map<
    HTMLDivElement,
    ConfigureSSOProps | undefined
  >();
  protected premountOAuthConsentNodes = new Map<
    HTMLDivElement,
    OAuthConsentProps | undefined
  >();
  protected premountOAuthDeviceVerificationNodes = new Map<
    HTMLDivElement,
    OAuthDeviceVerificationProps | undefined
  >();
  protected premountTaskChooseOrganizationNodes = new Map<
    HTMLDivElement,
    TaskChooseOrganizationProps | undefined
  >();
  protected premountTaskResetPasswordNodes = new Map<
    HTMLDivElement,
    TaskResetPasswordProps | undefined
  >();
  protected premountTaskSetupMFANodes = new Map<
    HTMLDivElement,
    TaskSetupMFAProps | undefined
  >();
  // A separate Map of `addListener` method calls to handle multiple listeners.
  protected premountAddListenerCalls = new Map<
    ListenerCallback,
    {
      options?: ListenerOptions;
      unsubscribe: UnsubscribeCallback;
      nativeUnsubscribe?: UnsubscribeCallback;
    }
  >();

  /** Replays everything queued before load into the clerk-js just loaded. */
  protected replayQueuedCalls(clerkjs: BrowserClerk | HeadlessBrowserClerk) {
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

    if (this.preopenCheckout !== null) {
      clerkjs.__internal_openCheckout(this.preopenCheckout);
    }

    if (this.preopenPlanDetails !== null) {
      clerkjs.__internal_openPlanDetails(this.preopenPlanDetails);
    }

    if (this.preopenSubscriptionDetails !== null) {
      clerkjs.__internal_openSubscriptionDetails(
        this.preopenSubscriptionDetails
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
  }
}
