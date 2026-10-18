export { auth } from './auth';
export type { AuthHelper } from './auth';
export { clerkClient } from './clerk-client';
export { clerkMiddleware } from './middleware';
export type { ClerkMiddleware } from './middleware';
export type {
  ClerkMiddlewareOptions,
  ClerkMiddlewareOptionsCallback,
  ContentSecurityPolicyDirective,
  ContentSecurityPolicyOptions,
  FrontendApiProxyOptions,
  LoaderOptions,
  SessionAuthObjectWithRedirect
} from './types';

export { createClerkClient, verifyToken } from '@clerk/backend';
export {
  reverificationError,
  reverificationErrorResponse
} from '@clerk/shared/authorization-errors';

/**
 * Re-export resource types from @clerk/backend
 */
export type {
  // Resources
  AllowlistIdentifier,
  // Auth objects
  AuthObject,
  Client,
  EmailAddress,
  ExternalAccount,
  Invitation,
  MachineAuthObject,
  OauthAccessToken,
  Organization,
  OrganizationDomain,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationMembershipPublicUserData,
  OrganizationMembershipRole,
  PhoneNumber,
  SMSMessage,
  Session,
  SessionAuthObject,
  SignInToken,
  Token,
  User,
  // Webhook event types
  WebhookEvent,
  WebhookEventType
} from '@clerk/backend';
