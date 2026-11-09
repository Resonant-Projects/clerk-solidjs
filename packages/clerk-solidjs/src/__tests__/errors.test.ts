import * as shared from '@clerk/shared/error';
import { expectTypeOf } from 'expect-type';
import { describe, expect, it } from 'vitest';
import * as errors from '../errors';

// @clerk/react 6.18.6's `/errors` entry point, which re-exports each of these
// from @clerk/shared/error.
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
});
