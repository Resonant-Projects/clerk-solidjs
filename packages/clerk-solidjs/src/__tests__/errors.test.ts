import * as shared from '@clerk/shared/error';
import type { ClerkAPIError as ClerkAPIErrorShape } from '@clerk/shared/types';
import { expectTypeOf } from 'expect-type';
import { describe, expect, it } from 'vitest';
import * as errors from '../errors';

// @clerk/react's `/errors` entry point, which re-exports each of these from
// @clerk/shared/error. Unchanged from 6.18.6 through 6.19.6.
const reactErrorsExports = [
  'ClerkAPIResponseError',
  'ClerkOfflineError',
  'ClerkRuntimeError',
  'EmailLinkErrorCode',
  'EmailLinkErrorCodeStatus',
  'isClerkAPIResponseError',
  'isClerkRuntimeError',
  'isEmailLinkError',
  'isKnownError',
  'isMetamaskError',
  'isReverificationCancelledError'
] as const;

describe('@resonant-projects/clerk-solidjs/errors', () => {
  it('exports exactly what @clerk/react/errors exports', () => {
    expect(Object.keys(errors).sort()).toEqual([...reactErrorsExports].sort());
  });

  it.each(reactErrorsExports)(
    're-exports %s from @clerk/shared/error',
    (name) => {
      expect(errors[name]).toBeDefined();
      expect(errors[name]).toBe(shared[name]);
    }
  );

  it('narrows Clerk errors with the re-exported guards', () => {
    const runtime = new errors.ClerkRuntimeError('offline', {
      code: 'network_error'
    });
    expect(errors.isClerkRuntimeError(runtime)).toBe(true);
    expect(errors.isClerkAPIResponseError(runtime)).toBe(false);

    const api = new errors.ClerkAPIResponseError('bad request', {
      data: [],
      status: 400
    });
    expect(errors.isClerkAPIResponseError(api)).toBe(true);
    expect(errors.isClerkRuntimeError(api)).toBe(false);

    const cancelled = new errors.ClerkRuntimeError('cancelled', {
      code: 'reverification_cancelled'
    });
    expect(errors.isReverificationCancelledError(cancelled)).toBe(true);
    expect(errors.isReverificationCancelledError(runtime)).toBe(false);

    expect(errors.ClerkOfflineError.is(new errors.ClerkOfflineError(''))).toBe(
      true
    );
    expect(errors.EmailLinkErrorCodeStatus.Expired).toBe('expired');
  });

  it('types each export as @clerk/shared/error does', () => {
    expectTypeOf(errors.ClerkAPIResponseError).toEqualTypeOf<
      typeof shared.ClerkAPIResponseError
    >();
    expectTypeOf(errors.ClerkOfflineError).toEqualTypeOf<
      typeof shared.ClerkOfflineError
    >();
    expectTypeOf(errors.ClerkRuntimeError).toEqualTypeOf<
      typeof shared.ClerkRuntimeError
    >();
    expectTypeOf(errors.EmailLinkErrorCodeStatus).toEqualTypeOf<
      typeof shared.EmailLinkErrorCodeStatus
    >();
    expectTypeOf(errors.isClerkRuntimeError).toEqualTypeOf<
      typeof shared.isClerkRuntimeError
    >();
    expectTypeOf(errors.isReverificationCancelledError).toEqualTypeOf<
      typeof shared.isReverificationCancelledError
    >();

    const narrow = (error: unknown) => {
      if (errors.isClerkRuntimeError(error)) {
        expectTypeOf(error).toEqualTypeOf<shared.ClerkRuntimeError>();
      }
    };
    narrow(undefined);
  });

  // @clerk/shared 4.45.0 added meta.providerError, parsed from the API's
  // meta.provider_error, for oauth_token_retrieval_error.
  it('carries the OAuth provider error on ClerkAPIResponseError', () => {
    const error = new errors.ClerkAPIResponseError('token retrieval failed', {
      status: 400,
      data: [
        {
          code: 'oauth_token_retrieval_error',
          message: 'token retrieval failed',
          meta: { provider_error: 'invalid_grant' }
        }
      ]
    });

    expect(error.errors[0]?.meta?.providerError).toBe('invalid_grant');
    // The error class types `meta` loosely; the shared interface types it.
    expectTypeOf<
      NonNullable<ClerkAPIErrorShape['meta']>['providerError']
    >().toEqualTypeOf<string | undefined>();
  });

  // @clerk/shared 4.49.0 added meta.remainingAttempts, parsed from the API's
  // meta.remaining_attempts, for a wrong current password; 0 means the
  // session has ended.
  it('carries the remaining password attempts on ClerkAPIResponseError', () => {
    const error = new errors.ClerkAPIResponseError('incorrect password', {
      status: 422,
      data: [
        {
          code: 'form_password_incorrect',
          message: 'incorrect password',
          meta: { remaining_attempts: 2 }
        }
      ]
    });

    expect(error.errors[0]?.meta?.remainingAttempts).toBe(2);
    expectTypeOf<
      NonNullable<ClerkAPIErrorShape['meta']>['remainingAttempts']
    >().toEqualTypeOf<number | undefined>();
  });
});
