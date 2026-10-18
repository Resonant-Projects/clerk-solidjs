import { createComputed, createMemo, For, type JSX, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { isServer, Portal } from 'solid-js/web';

/**
 * A piece of app JSX that Clerk asks us to render into a node it owns:
 * a custom page body, or the icon of a custom page, link or menu item.
 */
export type CustomElement = {
  id: string;
  render: () => JSX.Element;
};

const renderCache = new WeakMap<object, Map<string, () => JSX.Element>>();

/**
 * Returns one render function per token props object and key, so rebuilding
 * the elements keeps the same function for a token that did not change.
 */
export const renderProp = (
  props: object,
  key: 'children' | 'labelIcon'
): (() => JSX.Element) => {
  let byKey = renderCache.get(props);
  if (!byKey) {
    byKey = new Map();
    renderCache.set(props, byKey);
  }
  let render = byKey.get(key);
  if (!render) {
    render = () => (props as Record<string, JSX.Element>)[key];
    byKey.set(key, render);
  }
  return render;
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
    const renderers = createMemo(
      () =>
        new Map(props.elements.map((element) => [element.id, element.render]))
    );
    // Key the portals by id, not by element object: rebuilding the elements
    // (a sibling page renamed or added) must not remount content that Clerk
    // is showing, or it loses local state such as a half-filled form.
    const ids = createMemo(() => [...renderers().keys()]);

    // Forget the handlers of ids that are gone (a page removed or renamed),
    // so the map does not grow with every change. A node stays until Clerk
    // unmounts it, through the handler it already holds: it is how a modal
    // that is still open is told apart from a closed one.
    createComputed(() => {
      const current = renderers();
      for (const id of [...handlers.keys()]) {
        if (!current.has(id)) handlers.delete(id);
      }
    });

    return (
      <For each={ids()}>
        {(id) => (
          // Clerk only hands out nodes in the browser; the guard also keeps
          // Portal, which Solid 2 rejects on the server, off the server.
          <Show when={isServer ? undefined : nodes[id]} keyed>
            {(node) => (
              <Portal
                mount={node}
                // Portal wraps its content in a div; keep it out of Clerk's layout.
                ref={(wrapper: HTMLElement) => {
                  wrapper.style.display = 'contents';
                }}
              >
                {/* Render functions are stable per token, so this remounts only when
                    the token itself is replaced. The fragment keeps bare reactive
                    text in the body tracked, like props.children. */}
                <Show when={renderers().get(id)} keyed>
                  {(render) => <>{render()}</>}
                </Show>
              </Portal>
            )}
          </Show>
        )}
      </For>
    );
  };

  /** True while Clerk has any of these elements mounted, i.e. while its component or modal shows them. */
  const hasMountedNode = () => Object.values(nodes).some(Boolean);

  return { handlersFor, hasMountedNode, CustomElements };
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
