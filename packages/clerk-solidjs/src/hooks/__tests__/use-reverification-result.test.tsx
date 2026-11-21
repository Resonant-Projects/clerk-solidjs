import { reverificationError } from '@clerk/shared/authorization-errors';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ReverificationResult,
  UseReverificationOptions,
  UseReverificationResultOptions
} from '../..';
import { ClerkProvider, useReverification } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

// `passReverificationResult`, from @clerk/shared 4.46.0's useReverification.
// clerk-js 6.44.0's modal calls `afterVerification` with what the
// reverification did, such as a breached password the user reset. The types
// are pinned in use-reverification-types.test.ts.

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
  options?: UseReverificationOptions | UseReverificationResultOptions
) => {
  let wrapped!: (...args: any[]) => Promise<unknown>;
  const Probe = () => {
    wrapped = useReverification(fetcher, options as any);
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
});

describe('useReverification without passReverificationResult', () => {
  it('leaves the arguments alone, even given a result', async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher);

    const result = update('a');
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    openReverification.mock.calls[0][0].afterVerification(passwordReset);
    await expect(result).resolves.toBe('saved');
    expect(fetcher.mock.calls).toEqual([['a'], ['a']]);
  });

  it('ignores what complete is given, so a rejected promise still retries', async () => {
    const { clerkJS } = setup();
    const onNeedsReverification = vi.fn();
    const fetcher = needsReverification();
    const update = wrap(clerkJS, fetcher, { onNeedsReverification });

    const result = update('a');
    await vi.waitFor(() => expect(onNeedsReverification).toHaveBeenCalled());
    const rejected = Promise.reject(new Error('dialog closed'));
    rejected.catch(() => {});
    onNeedsReverification.mock.calls[0][0].complete(rejected);
    await expect(result).resolves.toBe('saved');
    expect(fetcher.mock.calls).toEqual([['a'], ['a']]);
  });
});
