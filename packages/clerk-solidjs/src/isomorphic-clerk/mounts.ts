import type {
  APIKeysProps,
  ConfigureSSOProps,
  CreateOrganizationProps,
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
  UserProfileProps,
  WaitlistProps
} from '@clerk/shared/types';

import { IsomorphicClerkModals } from './modals';

/** Mounting and unmounting Clerk's components, queued until clerk-js loads. */
export abstract class IsomorphicClerkMounts extends IsomorphicClerkModals {
  mountSignIn = (node: HTMLDivElement, props?: SignInProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountSignIn(node, props);
    } else {
      this.premountSignInNodes.set(node, props);
    }
  };

  unmountSignIn = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountSignIn(node);
    } else {
      this.premountSignInNodes.delete(node);
    }
  };

  mountPricingTable = (node: HTMLDivElement, props?: PricingTableProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountPricingTable(node, props);
    } else {
      this.premountPricingTableNodes.set(node, props);
    }
  };

  unmountPricingTable = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountPricingTable(node);
    } else {
      this.premountPricingTableNodes.delete(node);
    }
  };

  mountSignUp = (node: HTMLDivElement, props?: SignUpProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountSignUp(node, props);
    } else {
      this.premountSignUpNodes.set(node, props);
    }
  };

  unmountSignUp = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountSignUp(node);
    } else {
      this.premountSignUpNodes.delete(node);
    }
  };

  mountUserProfile = (node: HTMLDivElement, props?: UserProfileProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountUserProfile(node, props);
    } else {
      this.premountUserProfileNodes.set(node, props);
    }
  };

  unmountUserProfile = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountUserProfile(node);
    } else {
      this.premountUserProfileNodes.delete(node);
    }
  };

  mountOrganizationProfile = (
    node: HTMLDivElement,
    props?: OrganizationProfileProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountOrganizationProfile(node, props);
    } else {
      this.premountOrganizationProfileNodes.set(node, props);
    }
  };

  unmountOrganizationProfile = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountOrganizationProfile(node);
    } else {
      this.premountOrganizationProfileNodes.delete(node);
    }
  };

  mountCreateOrganization = (
    node: HTMLDivElement,
    props?: CreateOrganizationProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountCreateOrganization(node, props);
    } else {
      this.premountCreateOrganizationNodes.set(node, props);
    }
  };

  unmountCreateOrganization = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountCreateOrganization(node);
    } else {
      this.premountCreateOrganizationNodes.delete(node);
    }
  };

  mountOrganizationSwitcher = (
    node: HTMLDivElement,
    props?: OrganizationSwitcherProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountOrganizationSwitcher(node, props);
    } else {
      this.premountOrganizationSwitcherNodes.set(node, props);
    }
  };

  unmountOrganizationSwitcher = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountOrganizationSwitcher(node);
    } else {
      this.premountOrganizationSwitcherNodes.delete(node);
    }
  };

  __experimental_prefetchOrganizationSwitcher = () => {
    const callback = () =>
      this.clerkjs?.__experimental_prefetchOrganizationSwitcher();
    if (this.clerkjs && this.loaded) {
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
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountOrganizationList(node, props);
    } else {
      this.premountOrganizationListNodes.set(node, props);
    }
  };

  unmountOrganizationList = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountOrganizationList(node);
    } else {
      this.premountOrganizationListNodes.delete(node);
    }
  };

  mountUserButton = (
    node: HTMLDivElement,
    userButtonProps?: UserButtonProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountUserButton(node, userButtonProps);
    } else {
      this.premountUserButtonNodes.set(node, userButtonProps);
    }
  };

  unmountUserButton = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountUserButton(node);
    } else {
      this.premountUserButtonNodes.delete(node);
    }
  };

  mountWaitlist = (node: HTMLDivElement, props?: WaitlistProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountWaitlist(node, props);
    } else {
      this.premountWaitlistNodes.set(node, props);
    }
  };

  unmountWaitlist = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountWaitlist(node);
    } else {
      this.premountWaitlistNodes.delete(node);
    }
  };

  mountUserAvatar = (node: HTMLDivElement, props?: UserAvatarProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountUserAvatar(node, props);
    } else {
      this.premountUserAvatarNodes.set(node, props);
    }
  };

  unmountUserAvatar = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountUserAvatar(node);
    } else {
      this.premountUserAvatarNodes.delete(node);
    }
  };

  mountAPIKeys = (node: HTMLDivElement, props?: APIKeysProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountAPIKeys(node, props);
    } else {
      this.premountAPIKeysNodes.set(node, props);
    }
  };

  unmountAPIKeys = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountAPIKeys(node);
    } else {
      this.premountAPIKeysNodes.delete(node);
    }
  };

  __internal_mountConfigureSSO = (
    node: HTMLDivElement,
    props?: ConfigureSSOProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_mountConfigureSSO(node, props);
    } else {
      this.premountConfigureSSONodes.set(node, props);
    }
  };

  __internal_unmountConfigureSSO = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_unmountConfigureSSO(node);
    } else {
      this.premountConfigureSSONodes.delete(node);
    }
  };

  __internal_mountConfigureDirectorySync = (
    node: HTMLDivElement,
    props?: ConfigureSSOProps
  ) => {
    if (this.clerkjs && this.loaded) {
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
      this.loaded &&
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
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_mountOAuthConsent(node, props);
    } else {
      this.premountOAuthConsentNodes.set(node, props);
    }
  };

  __internal_unmountOAuthConsent = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
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
    if (this.clerkjs && this.loaded) {
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
      this.loaded &&
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
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountTaskChooseOrganization(node, props);
    } else {
      this.premountTaskChooseOrganizationNodes.set(node, props);
    }
  };

  unmountTaskChooseOrganization = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountTaskChooseOrganization(node);
    } else {
      this.premountTaskChooseOrganizationNodes.delete(node);
    }
  };

  mountTaskResetPassword = (
    node: HTMLDivElement,
    props?: TaskResetPasswordProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountTaskResetPassword(node, props);
    } else {
      this.premountTaskResetPasswordNodes.set(node, props);
    }
  };

  unmountTaskResetPassword = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountTaskResetPassword(node);
    } else {
      this.premountTaskResetPasswordNodes.delete(node);
    }
  };

  mountTaskSetupMFA = (node: HTMLDivElement, props?: TaskSetupMFAProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.mountTaskSetupMFA(node, props);
    } else {
      this.premountTaskSetupMFANodes.set(node, props);
    }
  };

  unmountTaskSetupMFA = (node: HTMLDivElement) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.unmountTaskSetupMFA(node);
    } else {
      this.premountTaskSetupMFANodes.delete(node);
    }
  };
}
