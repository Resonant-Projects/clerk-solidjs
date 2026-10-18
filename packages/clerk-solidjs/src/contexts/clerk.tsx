import { deprecated } from '@clerk/shared/deprecated';
import { getEnvVariable } from '@clerk/shared/getEnvVariable';
import { isPublishableKey } from '@clerk/shared/keys';
import { JSX, mergeProps, splitProps, untrack } from 'solid-js';
import { errorThrower } from '../errors/error-thrower';
import { multipleClerkProvidersError } from '../errors/messages';
import type { ClerkProviderProps, IsomorphicClerkOptions, Ui } from '../types';
import { withMaxAllowedInstancesGuard } from '../utils';
import { ClerkContextProvider } from './clerk-context';

/** `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY`, as in @clerk/react. */
const publishableKeyFromEnv = () =>
  getEnvVariable('VITE_CLERK_PUBLISHABLE_KEY') ||
  getEnvVariable('CLERK_PUBLISHABLE_KEY') ||
  undefined;

function ClerkProviderBase<TUi extends Ui = Ui>(
  props: ClerkProviderProps<TUi>
): JSX.Element {
  const [local, rest] = splitProps(props, ['initialState', 'children']);

  // A prop of `undefined` falls back to the env; an empty string does not, so
  // a framework that passes `''` for an unset variable still gets the error.
  const publishableKey = () =>
    rest.publishableKey === undefined
      ? publishableKeyFromEnv()
      : rest.publishableKey;

  // Validated during render, so a missing or malformed key also fails on the
  // server instead of only after the first client render.
  untrack(() => {
    if (rest.Clerk) return;
    const key = publishableKey();
    if (!key) {
      errorThrower.throwMissingPublishableKeyError();
    } else if (!isPublishableKey(key)) {
      errorThrower.throwInvalidPublishableKeyError({ key });
    }
  });

  // Core 3 removed afterSignInUrl and afterSignUpUrl, and clerk-js ignores
  // them. Until 4.0 they stand in for the fallback redirect URLs.
  untrack(() => {
    // The SolidStart provider passes '' for an unset env variable.
    if (rest.afterSignInUrl) {
      deprecated(
        'afterSignInUrl',
        'Use `signInFallbackRedirectUrl` or `signInForceRedirectUrl` instead.'
      );
    }
    if (rest.afterSignUpUrl) {
      deprecated(
        'afterSignUpUrl',
        'Use `signUpFallbackRedirectUrl` or `signUpForceRedirectUrl` instead.'
      );
    }
  });

  const options = mergeProps(rest, {
    get publishableKey() {
      return publishableKey();
    },
    get signInFallbackRedirectUrl() {
      return rest.signInFallbackRedirectUrl || rest.afterSignInUrl || undefined;
    },
    get signUpFallbackRedirectUrl() {
      return rest.signUpFallbackRedirectUrl || rest.afterSignUpUrl || undefined;
    }
  }) as unknown as IsomorphicClerkOptions;

  return (
    <ClerkContextProvider
      initialState={local.initialState}
      isomorphicClerkOptions={options}
    >
      {local.children}
    </ClerkContextProvider>
  );
}

const ClerkProvider = withMaxAllowedInstancesGuard(
  ClerkProviderBase,
  'ClerkProvider',
  multipleClerkProvidersError
) as typeof ClerkProviderBase;

export { ClerkProvider };
