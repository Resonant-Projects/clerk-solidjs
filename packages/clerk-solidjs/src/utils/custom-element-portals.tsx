import { createMemo, For, type JSX, Show, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Portal } from 'solid-js/web';

/**
 * A piece of app JSX that Clerk asks us to render into a node it owns:
 * a custom page body, or the icon of a custom page, link or menu item.
 */
export type CustomElement = {
  id: string;
  render: () => JSX.Element;
};

export type CustomElementHandlers = {
  mount: (node: Element) => void;
  unmount: () => void;
};

/**
 * Solid port of `useCustomElementPortal` from `@clerk/react`.
 *
 * Clerk calls `mount(node)` when it shows a custom element and `unmount()`
 * when it hides it. The elements render through Solid's `<Portal>` from inside
 * the Clerk component, so app context (router, theme, data clients) still
 * reaches them.
 */
export const createCustomElementPortals = () => {
  const [nodes, setNodes] = createStore<Record<string, Element | undefined>>(
    {}
  );
  // Clerk compares these callbacks between renders, so keep one pair per id.
  const handlers = new Map<string, CustomElementHandlers>();

  const handlersFor = (id: string): CustomElementHandlers => {
    let entry = handlers.get(id);
    if (!entry) {
      entry = {
        mount: (node) => setNodes(id, node),
        unmount: () => setNodes(id, undefined)
      };
      handlers.set(id, entry);
    }
    return entry;
  };

  const CustomElements = (props: { elements: CustomElement[] }) => {
    // Key the portals by id, not by element object: rebuilding the elements
    // (a sibling page renamed or added) must not remount content that Clerk
    // is showing, or it loses local state such as a half-filled form.
    let renderers = new Map<string, () => JSX.Element>();
    const ids = createMemo(() => {
      renderers = new Map(
        props.elements.map((element) => [element.id, element.render])
      );
      return [...renderers.keys()];
    });

    return (
      <For each={ids()}>
        {(id) => (
          <Show when={nodes[id]} keyed>
            {(node) => (
              <Portal
                mount={node}
                // Portal wraps its content in a div; keep it out of Clerk's layout.
                ref={(wrapper: HTMLElement) => {
                  wrapper.style.display = 'contents';
                }}
              >
                {untrack(() => renderers.get(id)?.())}
              </Portal>
            )}
          </Show>
        )}
      </For>
    );
  };

  return { handlersFor, CustomElements };
};

/**
 * Builds a stable portal id from what identifies a custom item, counting
 * repeats so two identical items keep separate portals.
 */
export const createPortalIdFactory = () => {
  const counts = new Map<string, number>();
  return (type: string, label: string, target: string | undefined) => {
    const baseId = `${type}:${label}:${target ?? ''}`;
    const occurrence = counts.get(baseId) ?? 0;
    counts.set(baseId, occurrence + 1);
    return `${baseId}:${occurrence}`;
  };
};
