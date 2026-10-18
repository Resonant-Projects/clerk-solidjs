import { reverificationError } from '@clerk/shared/authorization-errors';
import { ClerkAPIResponseError } from '@clerk/shared/error';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UseReverificationOptions } from '../..';
import { ClerkProvider, useReverification } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const setup = () => {
  const { clerkJS } = createFakeClerkJS();
  const openReverification = vi.fn();
  Object.assign(clerkJS, { __internal_openReverification: openReverification });
  return { clerkJS, openReverification };
};

/** Renders a component that wraps `fetcher` and returns the wrapper. */
const wrap = <F extends (...args: any[]) => Promise<any>>(
  clerkJS: ReturnType<typeof setup>['clerkJS'],
  fetcher: F,
  options?: UseReverificationOptions
) => {
  let wrapped!: (...args: Parameters<F>) => Promise<unknown>;
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

afterEach(() => {
  cleanup();
});

describe('useReverification', () => {
  it("opens Clerk's reverification modal for a hint, then runs the fetcher again", async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reverificationError('strict'))
      .mockResolvedValueOnce({ ok: true });
    const update = wrap(clerkJS, fetcher);

    const result = update('email_1');
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    const [props] = openReverification.mock.calls[0];
    expect(props.level).toBe('second_factor');
    expect(fetcher).toHaveBeenCalledTimes(1);

    props.afterVerification();
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('email_1');
  });

  it('hands the prompt to onNeedsReverification, and rejects when it is cancelled', async () => {
    const { clerkJS, openReverification } = setup();
    const onNeedsReverification = vi.fn();
    const update = wrap(
      clerkJS,
      vi
        .fn()
        .mockResolvedValue(
          reverificationError({ level: 'first_factor', afterMinutes: 5 })
        ),
      { onNeedsReverification }
    );

    const result = update();
    await vi.waitFor(() => expect(onNeedsReverification).toHaveBeenCalled());
    const [{ cancel, level }] = onNeedsReverification.mock.calls[0];
    expect(level).toBe('first_factor');
    expect(openReverification).not.toHaveBeenCalled();

    cancel();
    await expect(result).rejects.toMatchObject({
      code: 'reverification_cancelled'
    });
  });

  it('treats a session_reverification_required error from Clerk as a hint', async () => {
    const { clerkJS, openReverification } = setup();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(
        new ClerkAPIResponseError('reverify', {
          data: [
            {
              code: 'session_reverification_required',
              message: 'Reverify',
              long_message: 'Reverify'
            }
          ],
          status: 403
        })
      )
      .mockResolvedValueOnce('done');
    const update = wrap(clerkJS, fetcher);

    const result = update();
    await vi.waitFor(() => expect(openReverification).toHaveBeenCalled());
    openReverification.mock.calls[0][0].afterVerification();
    await expect(result).resolves.toBe('done');
  });

  it('reads a Response as JSON, and passes other errors through', async () => {
    const { clerkJS } = setup();
    const fromResponse = wrap(clerkJS, async () =>
      Response.json({ name: 'Ada' })
    );
    await expect(fromResponse()).resolves.toEqual({ name: 'Ada' });

    cleanup();
    const failing = wrap(clerkJS, async () => {
      throw new Error('network down');
    });
    await expect(failing()).rejects.toThrow('network down');
  });
});
