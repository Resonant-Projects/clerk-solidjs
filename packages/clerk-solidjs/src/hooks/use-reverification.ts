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
import type {
  ReverificationResult,
  SessionVerificationLevel
} from '@clerk/shared/types';
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
  /**
   * Runs the fetcher again. Pass what the reverification did, if anything;
   * with `passReverificationResult` the fetcher receives it. It can still be
   * called with no arguments, or passed where any value is ignored.
   */
  complete: {
    (): void;
    (result: ReverificationResult | undefined): void;
  };
  level: SessionVerificationLevel | undefined;
};

export type UseReverificationOptions = {
  /**
   * Called instead of opening Clerk's reverification modal, for apps that
   * render their own. Call `complete` or `cancel` when it is done.
   */
  onNeedsReverification?: (properties: NeedsReverificationParameters) => void;
  /**
   * When `true`, the fetcher's first argument is a `ReverificationResult`
   * (`undefined` on the first call), and the returned function takes the
   * remaining arguments. After the user resets a breached password to
   * reverify, `passwordReset` is set and the new password is already saved,
   * so a password change should not be sent again.
   *
   * @example
   * const updatePassword = useReverification(
   *   (
   *     reverification: ReverificationResult | undefined,
   *     currentUser: UserResource,
   *     params: UpdateUserPasswordParams
   *   ) =>
   *     reverification?.passwordReset
   *       ? currentUser.reload()
   *       : currentUser.updatePassword(params),
   *   { passReverificationResult: true }
   * );
   *
   * await updatePassword(user()!, { newPassword, signOutOfOtherSessions: true });
   */
  passReverificationResult?: true;
};

export type UseReverificationResult<
  Fetcher extends (...args: any[]) => Promise<any> | undefined,
  Args extends any[] = Parameters<Fetcher>
> = (...args: Args) => Promise<ExcludeClerkError<Awaited<ReturnType<Fetcher>>>>;

/** The fetcher's parameters after the leading `ReverificationResult`. */
type ParametersAfterResult<
  Fetcher extends (...args: any[]) => Promise<any> | undefined
> =
  Parameters<Fetcher> extends [any?, ...infer Rest]
    ? Rest
    : Parameters<Fetcher>;

/**
 * Wraps a fetcher that may need the user to verify again. When it returns
 * Clerk's reverification hint (from `reverificationError()` on the server) or
 * fails with `session_reverification_required`, the wrapper opens Clerk's
 * reverification modal, or calls `onNeedsReverification`, and runs the
 * fetcher once more after the user verifies. Cancelling rejects with a
 * `ClerkRuntimeError` whose code is `reverification_cancelled`. With
 * `passReverificationResult`, the fetcher also receives what the
 * reverification did as its first argument.
 *
 * @example
 * const updatePrimaryEmail = useReverification((emailAddressId: string) =>
 *   user()!.update({ primaryEmailAddressId: emailAddressId })
 * );
 */
export function useReverification<
  Fetcher extends (
    reverification: ReverificationResult | undefined,
    ...args: any[]
  ) => Promise<any> | undefined
>(
  fetcher: Fetcher,
  options: UseReverificationOptions & { passReverificationResult: true }
): UseReverificationResult<Fetcher, ParametersAfterResult<Fetcher>>;
export function useReverification<
  Fetcher extends (...args: any[]) => Promise<any> | undefined,
  Options extends UseReverificationOptions = UseReverificationOptions
>(
  fetcher: Fetcher,
  options?: Options &
    (Options extends { passReverificationResult: true } ? never : unknown)
): UseReverificationResult<Fetcher>;
// Overloads rather than @clerk/shared's conditional `Options` generic, so an
// explicit `useReverification<Fetcher>(...)` still drops the leading result.
// The opt-in fetcher must accept `undefined` first, as the first call passes
// it. The second overload rejects options whose flag is known to be `true`,
// inline or stored, so they cannot fall through and skip that check. Options
// typed as `UseReverificationOptions` still match it, as before the flag.
export function useReverification(
  fetcher: (...args: any[]) => Promise<any> | undefined,
  options?: UseReverificationOptions
) {
  useAssertWrappedByClerkProvider('useReverification');
  const clerk = useIsomorphicClerkContext();

  recordTelemetryOnce(clerk, () =>
    eventMethodCalled('useReverification', {
      onNeedsReverification: Boolean(options?.onNeedsReverification),
      passReverificationResult: Boolean(options?.passReverificationResult)
    })
  );

  const callFetcher = (
    reverification: ReverificationResult | undefined,
    args: unknown[]
  ) =>
    options?.passReverificationResult
      ? fetcher(reverification, ...args)
      : fetcher(...args);

  return async (...args: unknown[]) => {
    let result = await resolveResult(callFetcher(undefined, args));

    if (isReverificationHint(result)) {
      let resolve!: (result: ReverificationResult | undefined) => void;
      let reject!: (error: unknown) => void;
      const verified = new Promise<ReverificationResult | undefined>(
        (res, rej) => {
          resolve = res;
          reject = rej;
        }
      );

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
      const complete = (reverificationResult?: ReverificationResult) =>
        resolve(reverificationResult);

      if (options?.onNeedsReverification === undefined) {
        untrack(clerk).__internal_openReverification({
          level,
          afterVerification: complete,
          afterVerificationCancelled: cancel
        });
      } else {
        options.onNeedsReverification({ cancel, complete, level });
      }

      result = await resolveResult(callFetcher(await verified, args));
    }

    return result;
  };
}
