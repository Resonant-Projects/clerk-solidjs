import { reverificationError } from '@clerk/shared/authorization-errors';
import type { SessionResource } from '@clerk/shared/types';
import { cleanup, render } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReverificationResult, UseReverificationOptions } from '../..';
import { ClerkProvider, useReverification } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

// `passReverificationResult`, from @clerk/shared 4.46.0's useReverification.
// clerk-js 6.44.0's modal calls `afterVerification` with what the
// reverification did, such as a breached password the user reset.

const passwordReset: ReverificationResult = {
  passwordReset: { newPassword: 'n3w-Passw0rd!', signOutOfOtherSessions: true }
};

const setup = () => {
  const { clerkJS } = createFakeClerkJS();
  const openReverification = vi.fn();
  Object.assign(clerkJS, { __internal_openReverification: openReverification });
  return { clerkJS, openReverification };
};

const wrap = (
  clerkJS: ReturnType<typeof setup>['clerkJS'],
  fetcher: (...args: any[]) => Promise<any>,
  options?: UseReverificationOptions
) => {
  let wrapped!: (...args: any[]) => Promise<unknown>;
  const Probe = () => {
    wrapped = useReverification(fetcher, options);
    return null;
  };
  render(() => (
    <ClerkProvider publishableKey={TEST_PUBLISHABLE_KEY} Clerk={clerkJS as any}>
      <Probe />
    </ClerkProvider>
  ));
  return wrapped;
};

const needsReverification = () =>
  vi
    .fn()
    .mockResolvedValueOnce(reverificationError('strict'))
    .mockResolvedValueOnce('saved');

afterEach(() => {
  cleanup();
});

describe('useReverification with passReverificationResult', () => {
  it("passes undefined first, then the modal's result to the retry", async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher, { passReverificationResult: true });

    const result = update('user_1', { newPassword: 'x' });
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    expect(fetcher).toHaveBeenNthCalledWith(1, undefined, 'user_1', {
      newPassword: 'x'
    });

    openReverification.mock.calls[0][0].afterVerification(passwordReset);
    await expect(result).resolves.toBe('saved');
    expect(fetcher).toHaveBeenNthCalledWith(2, passwordReset, 'user_1', {
      newPassword: 'x'
    });
  });

  it('passes the result given to onNeedsReverification’s complete', async () => {
    const { clerkJS, openReverification } = setup();
    const onNeedsReverification = vi.fn();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher, {
      passReverificationResult: true,
      onNeedsReverification
    });

    const result = update('a');
    await vi.waitFor(() => expect(onNeedsReverification).toHaveBeenCalled());
    onNeedsReverification.mock.calls[0][0].complete(passwordReset);
    await expect(result).resolves.toBe('saved');
    expect(openReverification).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenNthCalledWith(2, passwordReset, 'a');
  });

  it('passes undefined to the retry when the modal gives no result', async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher, { passReverificationResult: true });

    const result = update('a');
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    openReverification.mock.calls[0][0].afterVerification();
    await expect(result).resolves.toBe('saved');
    expect(fetcher).toHaveBeenNthCalledWith(2, undefined, 'a');
  });

  it('leaves the arguments alone without the option, even given a result', async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher);

    const result = update('a');
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    openReverification.mock.calls[0][0].afterVerification(passwordReset);
    await expect(result).resolves.toBe('saved');
    expect(fetcher.mock.calls).toEqual([['a'], ['a']]);
  });

  it('drops the leading result from the returned function’s parameters', () => {
    type Fetcher = (
      reverification: ReverificationResult | undefined,
      userId: string,
      params: { newPassword: string }
    ) => Promise<{ id: string }>;
    const fetcher = {} as Fetcher;
    const rest = [] as unknown as [
      userId: string,
      params: { newPassword: string }
    ];
    const inferred = () =>
      useReverification(fetcher, { passReverificationResult: true });
    // An explicit fetcher type must not lose the opt-in.
    const explicit = () =>
      useReverification<Fetcher>(fetcher, { passReverificationResult: true });
    const withHandler = () =>
      useReverification(fetcher, {
        passReverificationResult: true,
        onNeedsReverification: ({ complete }) => complete()
      });
    const without = () => useReverification(fetcher);

    expectTypeOf(inferred).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(explicit).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(withHandler).returns.parameters.toEqualTypeOf(rest);
    expectTypeOf(explicit).returns.returns.toEqualTypeOf<
      Promise<{ id: string }>
    >();
    expectTypeOf(without).returns.parameters.toEqualTypeOf<
      Parameters<Fetcher>
    >();
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
