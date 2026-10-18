import { createContext, JSX, useContext } from 'solid-js';

type GetContainer = () => HTMLElement | null;

const PortalContext = createContext<GetContainer>();

/**
 * Renders the Clerk components and modals inside it into the element
 * `getContainer` returns, instead of `document.body`, so they can live in a
 * dialog, a popover or a shadow root. Like `@clerk/react`'s, it is marked
 * unsafe: Clerk's styles and focus handling assume the default container.
 *
 * @example
 * <UNSAFE_PortalProvider getContainer={() => dialogRef}>
 *   <UserButton />
 * </UNSAFE_PortalProvider>
 */
export const UNSAFE_PortalProvider = (props: {
  getContainer: GetContainer;
  children?: JSX.Element;
}): JSX.Element => (
  // A function, read at call time, so a changed `getContainer` prop is used.
  // eslint-disable-next-line solid/reactivity
  <PortalContext.Provider value={() => props.getContainer()}>
    {props.children}
  </PortalContext.Provider>
);

/**
 * The nearest `UNSAFE_PortalProvider`'s `getContainer`, or `undefined`
 * outside one.
 *
 * @internal
 */
export const usePortalRoot = (): GetContainer | undefined =>
  useContext(PortalContext);
