import { createComponent, createContext, type JSX, useContext } from 'solid-js';

/**
 * A context whose provider computes its value from its props, with a hook
 * that throws outside it and one that returns `undefined`. The value is
 * computed once, when the provider renders; pass accessors for values that
 * change.
 */
export function createContextProviderAndHook<T, P extends object>(
  name: string,
  factoryFn: (props: P) => T
) {
  const Context = createContext<T>();

  const ContextProvider = (
    props: P & { children?: JSX.Element }
  ): JSX.Element =>
    createComponent(Context.Provider, {
      value: factoryFn(props),
      get children() {
        return props.children;
      }
    });

  const useContextUnsafe = () => useContext(Context);

  const useContextOrThrow = () => {
    const ctx = useContext(Context);
    if (ctx === undefined) {
      throw new Error(`${name} not found`);
    }
    return ctx;
  };

  return [ContextProvider, useContextOrThrow, useContextUnsafe] as const;
}
