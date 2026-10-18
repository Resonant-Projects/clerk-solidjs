import { validateReverificationConfig } from '@clerk/shared/authorization';
import {
  isReverificationHint,
  reverificationError
} from '@clerk/shared/authorization-errors';
import {
  ClerkRuntimeError,
  isClerkAPIResponseError
} from '@clerk/shared/error';
import { eventMethodCalled } from '@clerk/shared/telemetry';
import type { SessionVerificationLevel } from '@clerk/shared/types';
import { untrack } from 'solid-js';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

const CLERK_API_REVERIFICATION_ERROR_CODE = 'session_reverification_required';

/** The fetcher's result, with a Response read as JSON and Clerk's reverification error as a hint. */
async function resolveResult<T>(
  result: Promise<T> | T
): Promise<T | ReturnType<typeof reverificationError>> {
  try {
    const resolved = await result;
    if (resolved instanceof Response) {
      return resolved.json();
    }
    return resolved;
  } catch (error) {
    if (
      isClerkAPIResponseError(error) &&
      error.errors.find(
        ({ code }) => code === CLERK_API_REVERIFICATION_ERROR_CODE
      )
    ) {
      return reverificationError();
    }
    throw error;
  }
}

type ExcludeClerkError<T> = T extends { clerk_error: any } ? never : T;

export type NeedsReverificationParameters = {
  /** Rejects the call with a `reverification_cancelled` error. */
  cancel: () => void;
  /** Runs the fetcher again. */
  complete: () => void;
  level: SessionVerificationLevel | undefined;
};

export type UseReverificationOptions = {
  /**
   * Called instead of opening Clerk's reverification modal, for apps that
   * render their own. Call `complete` or `cancel` when it is done.
   */
  onNeedsReverification?: (properties: NeedsReverificationParameters) => void;
};

export type UseReverificationResult<
  Fetcher extends (...args: any[]) => Promise<any> | undefined
> = (
  ...args: Parameters<Fetcher>
) => Promise<ExcludeClerkError<Awaited<ReturnType<Fetcher>>>>;

/**
 * Wraps a fetcher that may need the user to verify again. When it returns
 * Clerk's reverification hint (from `reverificationError()` on the server) or
 * fails with `session_reverification_required`, the wrapper opens Clerk's
 * reverification modal, or calls `onNeedsReverification`, and runs the
 * fetcher once more after the user verifies. Cancelling rejects with a
 * `ClerkRuntimeError` whose code is `reverification_cancelled`.
 *
 * @example
 * const updatePrimaryEmail = useReverification((emailAddressId: string) =>
 *   user()!.update({ primaryEmailAddressId: emailAddressId })
 * );
 */
export const useReverification = <
  Fetcher extends (...args: any[]) => Promise<any> | undefined
>(
  fetcher: Fetcher,
  options?: UseReverificationOptions
): UseReverificationResult<Fetcher> => {
  useAssertWrappedByClerkProvider('useReverification');
  const clerk = useIsomorphicClerkContext();

  recordTelemetryOnce(clerk, () =>
    eventMethodCalled('useReverification', {
      onNeedsReverification: Boolean(options?.onNeedsReverification)
    })
  );

  return (async (...args: Parameters<Fetcher>) => {
    let result = await resolveResult(fetcher(...args));

    if (isReverificationHint(result)) {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const verified = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      const config = validateReverificationConfig(
        result.clerk_error.metadata?.reverification
      );
      const level = config ? config().level : undefined;

      const cancel = () =>
        reject(
          new ClerkRuntimeError('User cancelled attempted verification', {
            code: 'reverification_cancelled'
          })
        );
      const complete = () => resolve();

      if (options?.onNeedsReverification === undefined) {
        untrack(clerk).__internal_openReverification({
          level,
          afterVerification: complete,
          afterVerificationCancelled: cancel
        });
      } else {
        options.onNeedsReverification({ cancel, complete, level });
      }

      await verified;
      result = await resolveResult(fetcher(...args));
    }

    return result;
  }) as UseReverificationResult<Fetcher>;
};
