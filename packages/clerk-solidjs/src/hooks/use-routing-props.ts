import type { RoutingOptions } from '@clerk/shared/types';
import { mergeProps, untrack } from 'solid-js';
import { errorThrower } from '../errors/error-thrower';
import {
  incompatibleRoutingWithPathProvidedError,
  noPathProvidedError
} from '../errors/messages';

/**
 * A component's props with Clerk's routing defaults, as
 * `@clerk/react/internal`'s `useRoutingProps`: path routing unless the props
 * or `routingOptions` say otherwise, which needs a `path`, and no `path`
 * with any other routing. The props stay reactive; the checks run once.
 *
 * @internal
 */
export function useRoutingProps<T extends RoutingOptions>(
  componentName: string,
  props: T,
  routingOptions?: RoutingOptions
): T {
  const routing = () =>
    props.routing || routingOptions?.routing || ('path' as const);

  untrack(() => {
    if (routing() === 'path') {
      if (!(props.path || routingOptions?.path)) {
        errorThrower.throw(noPathProvidedError(componentName));
      }
    } else if (props.path) {
      errorThrower.throw(
        incompatibleRoutingWithPathProvidedError(componentName)
      );
    }
  });

  return mergeProps(routingOptions ?? {}, props, {
    get routing() {
      return routing();
    },
    get path() {
      return routing() === 'path'
        ? props.path || routingOptions?.path
        : undefined;
    }
  }) as T;
}
