import type {
  __internal_AttemptToEnableEnvironmentSettingParams,
  __internal_AttemptToEnableEnvironmentSettingResult,
  __internal_CheckoutProps,
  __internal_EnableOrganizationsPromptProps,
  __internal_PlanDetailsProps,
  __internal_SubscriptionDetailsProps,
  __internal_UserVerificationModalProps,
  CreateOrganizationProps,
  GoogleOneTapProps,
  InviteMembersModalProps,
  OrganizationProfileProps,
  SignInProps,
  SignUpProps,
  UserProfileProps,
  WaitlistProps
} from '@clerk/shared/types';

import { IsomorphicClerkResources } from './resources';

/** Opening and closing Clerk's modals, queued until clerk-js loads. */
export abstract class IsomorphicClerkModals extends IsomorphicClerkResources {
  openSignIn = (props?: SignInProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openSignIn(props);
    } else {
      this.preopenSignIn = props;
    }
  };

  closeSignIn = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeSignIn();
    } else {
      this.preopenSignIn = null;
    }
  };

  __internal_openReverification = (
    props?: __internal_UserVerificationModalProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_openReverification(props);
    } else {
      this.preopenUserVerification = props;
    }
  };

  __internal_closeReverification = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_closeReverification();
    } else {
      this.preopenUserVerification = null;
    }
  };

  openGoogleOneTap = (props?: GoogleOneTapProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openGoogleOneTap(props);
    } else {
      this.preopenOneTap = props;
    }
  };

  closeGoogleOneTap = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeGoogleOneTap();
    } else {
      this.preopenOneTap = null;
    }
  };

  openUserProfile = (props?: UserProfileProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openUserProfile(props);
    } else {
      this.preopenUserProfile = props;
    }
  };

  closeUserProfile = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeUserProfile();
    } else {
      this.preopenUserProfile = null;
    }
  };

  openOrganizationProfile = (props?: OrganizationProfileProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openOrganizationProfile(props);
    } else {
      this.preopenOrganizationProfile = props;
    }
  };

  closeOrganizationProfile = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeOrganizationProfile();
    } else {
      this.preopenOrganizationProfile = null;
    }
  };

  openCreateOrganization = (props?: CreateOrganizationProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openCreateOrganization(props);
    } else {
      this.preopenCreateOrganization = props;
    }
  };

  closeCreateOrganization = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeCreateOrganization();
    } else {
      this.preopenCreateOrganization = null;
    }
  };

  openWaitlist = (props?: WaitlistProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openWaitlist(props);
    } else {
      this.preOpenWaitlist = props;
    }
  };

  closeWaitlist = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeWaitlist();
    } else {
      this.preOpenWaitlist = null;
    }
  };

  __internal_openCheckout = (props?: __internal_CheckoutProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_openCheckout(props);
    } else {
      this.preopenCheckout = props;
    }
  };

  __internal_closeCheckout = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_closeCheckout();
    } else {
      this.preopenCheckout = null;
    }
  };

  __internal_openPlanDetails = (props: __internal_PlanDetailsProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_openPlanDetails(props);
    } else {
      this.preopenPlanDetails = props;
    }
  };

  __internal_closePlanDetails = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_closePlanDetails();
    } else {
      this.preopenPlanDetails = null;
    }
  };

  __internal_openSubscriptionDetails = (
    props?: __internal_SubscriptionDetailsProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_openSubscriptionDetails(props);
    } else {
      // `{}`, not null, so a call without props still opens it after load.
      this.preopenSubscriptionDetails = props ?? {};
    }
  };

  __internal_closeSubscriptionDetails = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_closeSubscriptionDetails();
    } else {
      this.preopenSubscriptionDetails = null;
    }
  };

  /** Loads Stripe.js through clerk-js, once it has loaded. */
  __internal_loadStripeJs = async () => {
    const clerkjs = await this.waitForClerkJS();
    return clerkjs.__internal_loadStripeJs();
  };

  openInviteMembers = (props?: InviteMembersModalProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openInviteMembers(props);
    } else {
      this.preopenInviteMembers = props;
    }
  };

  closeInviteMembers = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeInviteMembers();
    } else {
      this.preopenInviteMembers = null;
    }
  };

  __internal_openEnableOrganizationsPrompt = (
    props: __internal_EnableOrganizationsPromptProps
  ) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.__internal_openEnableOrganizationsPrompt(props);
    } else {
      this.preopenEnableOrganizationsPrompt = props;
    }
  };

  __internal_closeEnableOrganizationsPrompt = () => {
    if (this.clerkjs && this.loaded) {
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
    if (this.clerkjs && this.loaded) {
      return callback() as __internal_AttemptToEnableEnvironmentSettingResult;
    } else {
      this.premountMethodCalls.set(
        '__internal_attemptToEnableEnvironmentSetting',
        callback
      );
    }
  };

  openSignUp = (props?: SignUpProps) => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.openSignUp(props);
    } else {
      this.preopenSignUp = props;
    }
  };

  closeSignUp = () => {
    if (this.clerkjs && this.loaded) {
      this.clerkjs.closeSignUp();
    } else {
      this.preopenSignUp = null;
    }
  };
}
