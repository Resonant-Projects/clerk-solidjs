---
"@resonant-projects/clerk-solidjs": minor
---

Advanced composition, and clean-ups.

- **`__experimental_asProvider` and `__experimental_Outlet`** on `UserButton` and `OrganizationSwitcher`: the component renders its children, and itself where its Outlet is, with its props, custom pages and menu items.
- **`@resonant-projects/clerk-solidjs/internal`**, for frameworks built on this package, as `@clerk/react/internal`: `MultisessionAppSupport`, `useDerivedAuth`, `useRoutingProps`, `publishableKeyFromHost` and `setErrorThrowerOptions`.
- **Headless runtimes:** with `experimental={{ runtimeEnvironment: 'headless' }}` and your own `Clerk`, the provider loads it without scripts, Clerk's UI or window globals. A failed load reports the `error` status.
- **One ClerkProvider per tree** is checked through context. A provider inside another still throws, but separate roots and islands each get their own, and nothing is counted on the server.
- **`useEmailLink`** returns plain functions, `startEmailLinkFlow(params)` and `cancelEmailLinkFlow()`, as `@clerk/react` does. The accessor style (`startEmailLinkFlow()(params)`) still works, with a deprecation warning. The flow is made when it starts, not in a memo, and is cancelled when the resource changes.
- Custom page and menu item warnings are logged from an effect, not while building (so not on the server), and the portal handlers of removed pages are dropped.
- `@solid-primitives/context` and `@solid-primitives/destructure` are no longer dependencies.
