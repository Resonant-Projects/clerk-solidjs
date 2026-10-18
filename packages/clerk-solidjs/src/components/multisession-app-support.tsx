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
  // A new tracked memo for each session: it owns the children, so they are
  // disposed when the session changes, and it keeps them reactive within one.
  return createMemo(
    on(key, () => createMemo(() => props.children))
  ) as unknown as JSX.Element;
};
