import { createMemo, type JSX, on, type ParentProps } from 'solid-js';
import { useSessionContext } from '../contexts/session';
import { useAssertWrappedByClerkProvider } from '../hooks/use-assert-wrapped-by-clerk-provider';

/**
 * Renders its children again, from scratch, whenever the active session
 * changes, as `@clerk/react/internal`'s `MultisessionAppSupport` keys them by
 * the session id. State in them starts over for each account.
 */
export const MultisessionAppSupport = (props: ParentProps): JSX.Element => {
  useAssertWrappedByClerkProvider('MultisessionAppSupport');
  const session = useSessionContext();
  const key = createMemo(() => session()?.id ?? 'no-users');
  // `on` reads the children untracked, so they are owned by this memo and
  // disposed when the session changes.
  return createMemo(on(key, () => props.children)) as unknown as JSX.Element;
};
