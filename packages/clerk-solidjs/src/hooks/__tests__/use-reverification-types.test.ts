import type { SessionResource } from '@clerk/shared/types';
import { expectTypeOf } from 'expect-type';
import { describe, expect, it } from 'vitest';
import type {
  NeedsReverificationParameters,
  ReverificationResult,
  UseReverificationOptions,
  UseReverificationResultOptions
} from '../..';
import { useReverification } from '../..';

// Type checks only: the functions below are never called, since the hook
// needs a ClerkProvider. Runtime behavior is in use-reverification-result.

type UpdatePassword = (
  reverification: ReverificationResult | undefined,
  userId: string,
  params: { newPassword: string }
) => Promise<{ id: string }>;
const updatePassword = {} as UpdatePassword;
const loadUser = async (userId: string) => userId;
const needsResult = async (result: ReverificationResult) =>
  result.passwordReset;
const verify = async () => null;

describe('useReverification types with passReverificationResult', () => {
  it('drops the leading result from the returned function’s parameters', () => {
    const rest = [] as unknown as [
      userId: string,
      params: { newPassword: string }
    ];
    const inferred = () =>
      useReverification(updatePassword, { passReverificationResult: true });
    const explicit = () =>
      useReverification<UpdatePassword>(updatePassword, {
        passReverificationResult: true
      });
    const stored: UseReverificationResultOptions = {
      passReverificationResult: true,
      onNeedsReverification: ({ complete }) => complete()
    };
    const fromStored = () => useReverification(updatePassword, stored);

    expectTypeOf(inferred).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(explicit).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(fromStored).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(explicit).returns.returns.toEqualTypeOf<
      Promise<{ id: string }>
    >();
  });

  it('requires the fetcher to accept undefined first, however the flag is set', () => {
    const asConst = {
      passReverificationResult: true,
      onNeedsReverification() {}
    } as const;
    const calls = [
      // @ts-expect-error Inline flag, inferred fetcher.
      () => useReverification(needsResult, { passReverificationResult: true }),
      () =>
        useReverification<typeof loadUser>(loadUser, {
          // @ts-expect-error Inline flag, explicit fetcher type.
          passReverificationResult: true
        }),
      // @ts-expect-error Stored flag, inferred fetcher.
      () => useReverification(loadUser, asConst),
      // @ts-expect-error Stored flag, explicit fetcher type.
      () => useReverification<typeof loadUser>(loadUser, asConst)
    ];
    expect(calls).toHaveLength(4);
  });

  it('lets complete take only a ReverificationResult, inline or stored', () => {
    const inline = () =>
      useReverification(updatePassword, {
        passReverificationResult: true,
        onNeedsReverification: ({ complete }) => {
          // @ts-expect-error The resolved null would reach the fetcher.
          void verify().then(complete);
          void verify().then(() => complete());
        }
      });
    const stored = {
      passReverificationResult: true,
      onNeedsReverification: ({ complete }) => {
        // @ts-expect-error The resolved null would reach the fetcher.
        void verify().then(complete);
      }
    } satisfies UseReverificationResultOptions;
    const plainWithFlag: UseReverificationOptions = {
      // @ts-expect-error The plain options type does not take the flag.
      passReverificationResult: true
    };
    expect([inline, stored, plainWithFlag]).toHaveLength(3);
  });
});

describe('useReverification types without the flag, as in 4.4.0', () => {
  it('keeps every fetcher parameter', () => {
    const options: UseReverificationOptions = {
      onNeedsReverification: () => {}
    };
    const plain = () => useReverification(loadUser);
    const explicit = () =>
      useReverification<typeof loadUser>(loadUser, options);
    expectTypeOf(plain).returns.parameters.toEqualTypeOf<[userId: string]>();
    expectTypeOf(explicit).returns.parameters.toEqualTypeOf<[userId: string]>();
  });

  it('keeps the options extendable and complete a plain callback', () => {
    interface DialogOptions extends UseReverificationOptions {
      title: string;
    }
    const dialog: DialogOptions = {
      title: 'Verify',
      onNeedsReverification: ({ complete }) => {
        void verify().then(complete);
      }
    };
    const wrapped = () => useReverification(loadUser, dialog);
    expectTypeOf<NeedsReverificationParameters['complete']>().toEqualTypeOf<
      () => void
    >();
    expectTypeOf(wrapped).returns.parameters.toEqualTypeOf<[userId: string]>();
  });
});

// Custom flows can build the same reset with the session's first factor.
describe('session reverification by password reset', () => {
  it('accepts the reset_password strategies', () => {
    type Prepare = Parameters<
      SessionResource['prepareFirstFactorVerification']
    >[0];
    type Attempt = Parameters<
      SessionResource['attemptFirstFactorVerification']
    >[0];
    expectTypeOf<{
      strategy: 'reset_password_email_code';
      emailAddressId: string;
    }>().toExtend<Prepare>();
    expectTypeOf<{
      strategy: 'reset_password_phone_code';
      phoneNumberId: string;
    }>().toExtend<Prepare>();
    expectTypeOf<{
      strategy: 'reset_password_email_code';
      code: string;
      password: string;
      signOutOfOtherSessions: boolean;
    }>().toExtend<Attempt>();
  });
});
