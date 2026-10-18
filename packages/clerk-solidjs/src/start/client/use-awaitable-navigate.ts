import type { NavigateOptions } from '@solidjs/router';
import { useIsRouting, useNavigate } from '@solidjs/router';
import { createEffect, onCleanup, untrack } from 'solid-js';

/**
 * `navigate()` that resolves once the router has finished the navigation,
 * including loading the new route, as Clerk's `routerPush` and
 * `routerReplace` expect. It resolves at once when nothing navigated, such as
 * a link to the current location.
 */
export const useAwaitableNavigate = () => {
  const navigate = useNavigate();
  const isRouting = useIsRouting();
  let pending: Array<() => void> = [];

  const settle = () => {
    const settled = pending;
    pending = [];
    settled.forEach((resolve) => resolve());
  };
  createEffect(() => {
    if (!isRouting()) settle();
  });
  // Never leave a caller waiting on a router that is gone.
  onCleanup(settle);

  return (to: string, options?: Partial<NavigateOptions>) =>
    new Promise<void>((resolve) => {
      navigate(to, options);
      // The router starts its transition synchronously; if it did not, the
      // target was the current location.
      if (untrack(isRouting)) {
        pending.push(resolve);
      } else {
        resolve();
      }
    });
};
