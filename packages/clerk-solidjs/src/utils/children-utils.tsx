import {
  createEffect,
  createMemo,
  JSX,
  onCleanup,
  children as resolveChildren,
  Show
} from 'solid-js';
import { delegateEvents, isServer } from 'solid-js/web';
import { errorThrower } from '../errors/error-thrower';
import { multipleChildrenInButtonComponent } from '../errors/messages';

export type ButtonComponentName =
  | 'SignInButton'
  | 'SignUpButton'
  | 'SignOutButton'
  | 'SignInWithMetamaskButton';

type ClickHandler =
  JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> | undefined;

/** Calls a Solid event handler, which can be a function or a bound tuple. */
const callHandler = (handler: ClickHandler, event: MouseEvent) => {
  if (typeof handler === 'function') {
    return (handler as (event: MouseEvent) => unknown)(event);
  }
  if (Array.isArray(handler) && typeof handler[0] === 'function') {
    return (handler[0] as (data: unknown, event: MouseEvent) => unknown)(
      handler[1],
      event
    );
  }
};

const isText = (child: unknown): child is string | number =>
  typeof child === 'string' || typeof child === 'number';

type DelegatedClickTarget = Element & {
  $$click?: (...args: unknown[]) => unknown;
};

/**
 * Makes `onClick` run after the element's own Solid `onClick`, awaiting it, as
 * @clerk/react does with `child.props.onClick`. A rendered Solid element keeps
 * no props, so this composes in the slot Solid's delegated click dispatch
 * reads (`$$click`), which also skips disabled elements and stops when a
 * handler calls `stopPropagation`. Returns a function that restores the slot.
 */
const composeClickHandler = (
  element: Element,
  onClick: (event: MouseEvent) => unknown
) => {
  const target = element as DelegatedClickTarget;
  let childHandler = target.$$click;
  // Solid calls a bound handler as (data, event), otherwise as (event).
  const composed = async function (this: Element, ...args: unknown[]) {
    const event = args[args.length - 1] as MouseEvent;
    await childHandler?.apply(this, args);
    return onClick(event);
  };
  Object.defineProperty(target, '$$click', {
    configurable: true,
    get: () => composed,
    // Solid assigns again when a reactive onClick changes.
    set: (handler) => {
      childHandler = handler;
    }
  });
  return () => {
    delete target.$$click;
    target.$$click = childHandler;
  };
};

/**
 * Renders a Clerk button. Text children, or none, render the default
 * `<button>` with `attributes`. A single element child, such as your own
 * `<button>`, renders as it is and gets the click handler, so buttons never
 * nest: its own `onClick` runs first and is awaited, then the button's
 * `onClick`, then the Clerk call. Server and client choose the same branch,
 * so the markup hydrates.
 */
export const ClerkButton = (props: {
  name: ButtonComponentName;
  defaultText: string;
  attributes: JSX.ButtonHTMLAttributes<HTMLButtonElement>;
  onClick: ClickHandler;
  /** The Clerk call to make after `onClick`. */
  action: () => unknown;
  children?: JSX.Element;
}): JSX.Element => {
  const resolved = resolveChildren(() => props.children);
  const child = createMemo(() => {
    const list = resolved
      .toArray()
      .filter(
        (item) =>
          item !== undefined &&
          item !== null &&
          item !== false &&
          item !== true &&
          item !== ''
      );
    if (list.length > 1) {
      return errorThrower.throw(multipleChildrenInButtonComponent(props.name));
    }
    return list[0];
  });
  const text = createMemo(() => {
    const current = child();
    if (current === undefined) return props.defaultText;
    return isText(current) ? current : undefined;
  });

  const handleClick = async (event: MouseEvent) => {
    await callHandler(props.onClick, event);
    return props.action();
  };

  if (!isServer) {
    delegateEvents(['click']);
    createEffect(() => {
      const element = child();
      if (!(element instanceof Element)) return;
      onCleanup(composeClickHandler(element, handleClick));
    });
  }

  return (
    <Show
      when={text() === undefined}
      fallback={
        <button {...props.attributes} onClick={handleClick}>
          {text()}
        </button>
      }
    >
      {child()}
    </Show>
  );
};
