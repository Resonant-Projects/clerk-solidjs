import { ClerkRuntimeError } from '@clerk/shared/error';
import { eventMethodCalled } from '@clerk/shared/telemetry';
import type {
  ClerkAPIResponseError,
  LookupOAuthDeviceVerificationParams,
  OAuthDeviceVerificationInfo,
  OAuthDeviceVerificationResult,
  SubmitOAuthDeviceVerificationParams
} from '@clerk/shared/types';
import { Accessor, batch, createSignal, untrack } from 'solid-js';
import { useIsomorphicClerkContext } from '../contexts/isomorphic-clerk';
import { useAssertWrappedByClerkProvider } from './use-assert-wrapped-by-clerk-provider';
import { recordTelemetryOnce } from './utils';

type HookError = ClerkAPIResponseError | ClerkRuntimeError;
type DecisionParams = Omit<SubmitOAuthDeviceVerificationParams, 'approved'>;

export type UseOAuthDeviceVerificationReturn = {
  /** The device and app asking for access, once looked up. */
  data: Accessor<OAuthDeviceVerificationInfo | undefined>;
  /** The outcome of `approve` or `deny`. */
  result: Accessor<OAuthDeviceVerificationResult | undefined>;
  error: Accessor<HookError | null>;
  isLoading: Accessor<boolean>;
  isSubmitting: Accessor<boolean>;
  lookup: (
    params: LookupOAuthDeviceVerificationParams
  ) => Promise<OAuthDeviceVerificationInfo>;
  approve: (params: DecisionParams) => Promise<OAuthDeviceVerificationResult>;
  deny: (
    params: LookupOAuthDeviceVerificationParams
  ) => Promise<OAuthDeviceVerificationResult>;
  /**
   * Clears the state; requests already running no longer update it. A
   * decision already sent keeps `isSubmitting` true, and blocks another,
   * until it settles.
   */
  reset: () => void;
};

/** The code as the user may type it: any case, with dashes or spaces. */
const normalizeUserCode = (userCode: string) =>
  userCode.toUpperCase().replace(/[-\p{White_Space}]/gu, '');

const notReady = () =>
  new ClerkRuntimeError(
    'Clerk must be loaded before using OAuth device verification.',
    { code: 'oauth_device_verification_not_ready' }
  );

const lookupInProgress = () =>
  new ClerkRuntimeError(
    'An OAuth device verification lookup is already in progress for another code.',
    { code: 'oauth_device_verification_lookup_in_progress' }
  );

const submissionInProgress = () =>
  new ClerkRuntimeError(
    'Another OAuth device verification decision is already in progress.',
    { code: 'oauth_device_verification_submission_in_progress' }
  );

/**
 * The OAuth device flow for the signed-in user, as `@clerk/shared`'s hook:
 * `lookup` a user code, then `approve` or `deny` it. A call repeated while
 * the same one is in flight returns the same promise; a different one
 * rejects. After `reset`, requests already running no longer change state.
 *
 * @example
 * const device = useOAuthDeviceVerification();
 * await device.lookup({ userCode: code() });
 * <Show when={device.data()}>{(info) => <p>{info().oauthApplicationName}</p>}</Show>
 * <button onClick={() => device.approve({ userCode: code() })}>Allow</button>
 */
export function useOAuthDeviceVerification(): UseOAuthDeviceVerificationReturn {
  useAssertWrappedByClerkProvider('useOAuthDeviceVerification');
  const clerk = useIsomorphicClerkContext();

  recordTelemetryOnce(clerk, () =>
    eventMethodCalled('useOAuthDeviceVerification')
  );

  const [data, setData] = createSignal<OAuthDeviceVerificationInfo>();
  const [result, setResult] = createSignal<OAuthDeviceVerificationResult>();
  const [error, setError] = createSignal<HookError | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  // Bookkeeping, not state anything renders: plain variables.
  let pendingLookup: {
    key: string;
    promise: Promise<OAuthDeviceVerificationInfo>;
  } | null = null;
  let pendingSubmit: {
    key: string;
    promise: Promise<OAuthDeviceVerificationResult>;
  } | null = null;
  let generation = 0;

  const oauthApplication = () => {
    const instance = untrack(clerk);
    return instance.loaded ? instance.oauthApplication : undefined;
  };

  const lookup = (params: LookupOAuthDeviceVerificationParams) => {
    const application = oauthApplication();
    if (!application) {
      return Promise.reject(notReady());
    }

    const key = normalizeUserCode(params.userCode);
    if (pendingLookup) {
      return pendingLookup.key === key
        ? pendingLookup.promise
        : Promise.reject(lookupInProgress());
    }

    const requestGeneration = generation;
    batch(() => {
      setError(null);
      setData(undefined);
      setResult(undefined);
      setIsLoading(true);
    });

    const request: Promise<OAuthDeviceVerificationInfo> = application
      .lookupDeviceVerification({ ...params, userCode: key })
      .then((info) => {
        if (generation === requestGeneration) setData(() => info);
        return info;
      })
      .catch((err: HookError) => {
        if (generation === requestGeneration) setError(() => err);
        throw err;
      })
      .finally(() => {
        if (pendingLookup?.promise === request) pendingLookup = null;
        if (generation === requestGeneration) setIsLoading(false);
      });

    pendingLookup = { key, promise: request };
    return request;
  };

  const submit = (params: DecisionParams, approved: boolean) => {
    const application = oauthApplication();
    if (!application) {
      return Promise.reject(notReady());
    }

    const userCode = normalizeUserCode(params.userCode);
    const key = JSON.stringify([
      userCode,
      params.organizationId ?? null,
      approved
    ]);
    if (pendingSubmit) {
      return pendingSubmit.key === key
        ? pendingSubmit.promise
        : Promise.reject(submissionInProgress());
    }

    const requestGeneration = generation;
    batch(() => {
      setError(null);
      setIsSubmitting(true);
    });

    const request: Promise<OAuthDeviceVerificationResult> = application
      .submitDeviceVerification({ ...params, userCode, approved })
      .then((decision) => {
        if (generation === requestGeneration) setResult(() => decision);
        return decision;
      })
      .catch((err: HookError) => {
        if (generation === requestGeneration) setError(() => err);
        throw err;
      })
      .finally(() => {
        // Submitting lasts until the decision settles, even after reset.
        if (pendingSubmit?.promise === request) {
          pendingSubmit = null;
          setIsSubmitting(false);
        }
      });

    pendingSubmit = { key, promise: request };
    return request;
  };

  const reset = () => {
    generation += 1;
    // A lookup is a read and can be dropped. A decision already on its way
    // to Clerk cannot: it still blocks another, as in @clerk/shared, so
    // isSubmitting stays true until it settles.
    pendingLookup = null;
    batch(() => {
      setData(undefined);
      setResult(undefined);
      setError(null);
      setIsLoading(false);
      setIsSubmitting(pendingSubmit !== null);
    });
  };

  return {
    data,
    result,
    error,
    isLoading,
    isSubmitting,
    lookup,
    approve: (params) => submit(params, true),
    deny: (params) => submit(params, false),
    reset
  };
}
