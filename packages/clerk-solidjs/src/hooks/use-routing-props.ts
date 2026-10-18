import type { RoutingOptions } from '@clerk/shared/types';
import { mergeProps, splitProps, untrack } from 'solid-js';
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

  // `path` and `routing` come only from the getters below: mergeProps reads
  // an undefined value as absent and falls back to an earlier source, so a
  // path left in one would survive non-path routing.
  const [, others] = splitProps(props, ['path', 'routing']);
  const options = Object.fromEntries(
    Object.entries(routingOptions ?? {}).filter(
      ([key]) => key !== 'path' && key !== 'routing'
    )
  );
  return mergeProps(options, others, {
    get routing() {
      return routing();
    },
    get path() {
      return routing() === 'path'
        ? props.path || routingOptions?.path
        : undefined;
    }
  }) as unknown as T;
}
