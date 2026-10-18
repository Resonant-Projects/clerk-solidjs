import { getEnvVariable } from '@clerk/shared/getEnvVariable';
import { isPublishableKey } from '@clerk/shared/keys';
import { JSX, mergeProps, splitProps, untrack, useContext } from 'solid-js';
import { errorThrower } from '../errors/error-thrower';
import { multipleClerkProvidersError } from '../errors/messages';
import type { ClerkProviderProps, IsomorphicClerkOptions, Ui } from '../types';
import { isConstructor } from '../utils';
import { ClerkContextProvider } from './clerk-context';
import { ClerkInstanceContext } from './clerk-instance';

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
    // A Clerk instance the app created carries its own key; a constructor
    // or the CDN build needs one.
    if (rest.Clerk && !isConstructor(rest.Clerk)) return;
    const key = publishableKey();
    if (!key) {
      errorThrower.throwMissingPublishableKeyError();
    } else if (!isPublishableKey(key)) {
      errorThrower.throwInvalidPublishableKeyError({ key });
    }
  });

  const options = mergeProps(rest, {
    get publishableKey() {
      return publishableKey();
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

/**
 * One ClerkProvider per tree. The check reads the context, as @clerk/react's
 * does: separate roots and islands each get their own, and nothing is
 * counted across requests on the server.
 */
const ClerkProvider = (<TUi extends Ui = Ui>(
  props: ClerkProviderProps<TUi>
): JSX.Element => {
  if (useContext(ClerkInstanceContext)) {
    errorThrower.throw(multipleClerkProvidersError);
  }
  return ClerkProviderBase(props);
}) as typeof ClerkProviderBase;

export { ClerkProvider };
