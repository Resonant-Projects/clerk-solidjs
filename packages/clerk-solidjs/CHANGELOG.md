# clerk-solidjs

## 4.3.3

### Patch Changes

- e00fd66: Update Clerk dependencies to the Oct 23 patch releases (`@clerk/backend` 3.26.2, `@clerk/shared` 4.41.1, `@clerk/clerk-js` 6.40.1, `@clerk/localizations` 4.24.1, `@clerk/ui` 1.41.2, `@clerk/testing` 2.2.50), and refresh `@tanstack/query-core` to 5.104.5 and `csstype` to 3.2.3.

## 4.3.2

### Patch Changes

- ebae4be: Update Clerk dependencies to the latest releases: `@clerk/backend` 3.26.1, `@clerk/shared` 4.41.0, `@clerk/clerk-js` 6.40.0, `@clerk/localizations` 4.24.0, `@clerk/ui` 1.41.1, and `@clerk/testing` 2.2.49.

  Gate sign-in `mfa.passkey` on Clerk load like the other MFA methods.

- 9bbb5a8: The `browser` field in `package.json` now just names the browser build of the main entry. It used to remap the server build that the `worker` condition chooses, so a bundler honouring both could give a worker the browser build. `exports` is unchanged.
- bb2a211: `<PricingTable>` hides its `fallback` once Clerk has loaded the plans. clerk-js marks the table's own element as ready, and the check looked only inside it, so the fallback stayed on screen beside the table.
- 0b227ac: Raise the `solid-js` peer dependency floor to `^1.9.8`.

  The package now relies on Solid behavior that fails on earlier `1.9.x` releases:
  the test suite reproduces `setStyleProperty is not a function` on `1.9.0` through
  `1.9.7`, while `1.9.8` is the oldest passing version we verified.

## 4.3.1

### Patch Changes

- 31b6d21: `clerkMiddleware()`'s `contentSecurityPolicy` fixes:

  - Keywords are quoted where the directive takes them, whatever their case, as CSP requires. In source lists, that is every keyword in CSP3, such as `wasm-unsafe-eval`, `report-sample` and `trusted-types-eval`, plus `inline-speculation-rules`. It also covers `script` in `require-trusted-types-for` and `none` and `allow-duplicates` in `trusted-types`. Unquoted, browsers ignored them. Policy names, `report-to` groups and hosts stay bare, and `trusted-types` policy names keep their case.
  - With `reportTo` and a `report-to` directive, the policy had two `report-to` directives, and browsers use the first, so reports never reached `reportTo`. `reportTo`'s group now replaces the directive.

## 4.3.0

### Minor Changes

- 598190c: Advanced composition, and clean-ups.

  - **`__experimental_asProvider` and `__experimental_Outlet`** on `UserButton` and `OrganizationSwitcher`: the component renders its children, and itself where its Outlet is, with its props, custom pages and menu items.
  - **`@resonant-projects/clerk-solidjs/internal`**, for frameworks built on this package, as `@clerk/react/internal`: `MultisessionAppSupport`, `useDerivedAuth`, `useRoutingProps`, `publishableKeyFromHost` and `setErrorThrowerOptions`.
  - **Headless runtimes:** with `experimental={{ runtimeEnvironment: 'headless' }}` and your own `Clerk`, the provider loads it without scripts, Clerk's UI or window globals. A failed load reports the `error` status.
  - **One ClerkProvider per tree** is checked through context. A provider inside another still throws, but separate roots and islands each get their own, and nothing is counted on the server.
  - **`useEmailLink`** returns plain functions, `startEmailLinkFlow(params)` and `cancelEmailLinkFlow()`, as `@clerk/react` does. The accessor style (`startEmailLinkFlow()(params)`) still works, with a deprecation warning. The flow is made when it starts, not in a memo, and is cancelled when the resource changes.
  - Custom page and menu item warnings are logged from an effect, not while building (so not on the server), and the portal handlers of removed pages are dropped.
  - `@solid-primitives/context` and `@solid-primitives/destructure` are no longer dependencies.

- 8658f11: Security and infrastructure options for `clerkMiddleware()`, as `@clerk/nextjs` has:

  - **`frontendApiProxy`** serves Clerk's Frontend API from your app, at `/__clerk` by default, for networks that block it. Unless you pass a `proxyUrl`, the browser uses the proxy too.
  - **`contentSecurityPolicy`** sets a `Content-Security-Policy` that allows Clerk, merged with your directives, with report-only and reporting options. In strict mode the per-request nonce is in `event.locals.clerkNonce`; pass it to SolidStart's `createHandler`.
  - **`debug`** logs each request's options, request state and auth, without credentials: keys cut short, cookies by name, URLs without parameter values, and headers that could carry a credential by name only.
  - **Netlify:** a handshake redirect on a development instance busts Netlify's cache, as the other Clerk SDKs do.
  - **`./start/server` in the browser:** a browser build gets a stand-in with the same exports, which throw when called. Route files can still import `auth` for their `"use server"` functions, and `@clerk/backend` stays out of the browser bundle.

## 4.2.0

### Minor Changes

- af08d4b: Billing, from a new `@resonant-projects/clerk-solidjs/experimental` entry. It is experimental in `@clerk/react` too, so its API can change in a minor release.

  - **Buttons:** `CheckoutButton`, `PlanDetailsButton` and `SubscriptionDetailsButton` open Clerk's billing drawers. Render them for a signed-in user, and with `for="organization"` only with an active organization.
  - **Hooks:**
    - `usePlans()`, `useStatements()`, `usePaymentAttempts()` and `usePaymentMethods()` page through billing data.
    - `useSubscription()` returns the user's or organization's subscription.
    - `useCheckout()`, with `CheckoutProvider`, drives a custom checkout from clerk-js's checkout signal.

    Params that can change are accessors.

  - **Payment form:** `PaymentElementProvider`, `PaymentElement` and `usePaymentElement()` render Stripe's payment form and submit it. Clerk loads Stripe.js itself.
  - The billing members of the Clerk instance (`billing`, `__experimental_checkout` and the drawer methods) are no longer stubs.

## 4.1.0

### Minor Changes

- cab18c1: The rest of `@clerk/react`'s components and hooks, apart from billing.

  - **Components:** `PricingTable` (its fallback waits until the plans are fetched), `APIKeys`, `UserAvatar`, `OAuthConsent`, `OAuthDeviceVerification` and `InviteMembersButton`.
  - **Hooks:**
    - `useAPIKeys()` pages through API keys.
    - `useOAuthConsent()` reads an OAuth application's consent info.
    - `useOAuthDeviceVerification()` looks up, approves or denies a device code.
    - `useOrganizationCreationDefaults()` returns the suggested organization defaults.

    Params that can change are accessors.

  - **The enable-organizations prompt:** on a development instance without organizations, `useOrganization()`, and `useOrganizationList()` with list params, ask Clerk once to offer turning them on.
  - **`UNSAFE_PortalProvider`:** renders Clerk's components and modals inside the element its `getContainer` returns, such as a dialog.
  - **`getToken()`** is exported from the root entry.

## 4.0.0

### Major Changes

- fee1896: Clerk Core 3's signal-based hooks, and the rest of the Clerk instance.

  - **Breaking: `useSignIn()` and `useSignUp()`** are Core 3's signal-based hooks, as in `@clerk/react` 6. They return `{ signIn, errors, fetchStatus }` and `{ signUp, errors, fetchStatus }`, kept current from clerk-js's signals. Their methods, such as `signIn.password()` and `signUp.verifications.sendEmailCode()`, wait for Clerk to load. On the server they return defaults. The resource and `errors` stay reactive when destructured; read `fetchStatus` from the result.

    The Core 2 hooks, with `isLoaded`, the client's resource and `setActive`, move to a new `./legacy` entry, like `@clerk/react/legacy`:

    ```diff
    -import { useSignIn } from '@resonant-projects/clerk-solidjs';
    +import { useSignIn } from '@resonant-projects/clerk-solidjs/legacy';
    ```

  - **New `useWaitlist()`:** `{ waitlist, errors, fetchStatus }`. Join with `waitlist.join({ emailAddress })`.
  - **New `useReverification(fetcher, options?)`:** wraps a call that may need the user to verify again. It opens Clerk's reverification modal, or calls `onNeedsReverification`, then runs the call once more.
  - **Clerk instance:** `useClerk()` now also has `authenticateWithBase()`, `authenticateWithSolana()`, `apiKeys`, `oauthApplication`, `uiVersion`, `openInviteMembers()` and the enable-organizations prompt. It can also mount the UserAvatar, APIKeys, OAuthConsent, OAuth device verification, SSO and directory sync components; their Solid components come in a later release. Calls made before clerk-js loads wait for it. `addListener()` keeps its options until then, and `__internal_getOption()` reads the provider's options until then. Errors loading clerk-js name this package.

- 9c0bcca: Session tasks, the SSO callback, and the 4.0 removals. See MIGRATION.md for each change.

  - **Breaking: `SignedIn`, `SignedOut` and `Protect` are removed.** Use `<Show when="signed-in">`, `<Show when="signed-out">` and `<Show when={{ role }}>` or `<Show when={(has) => …}>`, as in `@clerk/react` 6.
  - **Breaking: the Core 2 `afterSignInUrl` and `afterSignUpUrl` props are removed**, from `ClerkProvider`, the SolidStart provider and `clerkMiddleware()`. Use `signInFallbackRedirectUrl` and `signUpFallbackRedirectUrl`. `CLERK_AFTER_SIGN_IN_URL` and `CLERK_AFTER_SIGN_UP_URL` are no longer read.
  - **Breaking: ESM only.** The package has no CommonJS builds or `require` conditions. Each CommonJS entry carried its own copy of the Clerk contexts.
  - **Breaking: peers.** `solid-js` `^1.9`. `@solidjs/start` `^2` and `@solidjs/router` `>=0.16 <2` are optional peers, used by the `/start` entries.
  - **Breaking: `useClerk()()`'s `__unstable__environment`, `__unstable__setEnvironment` and `__unstable__updateProps` are removed.** Use the `__internal_` members.
  - **New: session tasks.** `TaskChooseOrganization`, `TaskResetPassword` and `TaskSetupMFA` mount Clerk's task components. `RedirectToTasks`, and `buildTasksUrl()` and `redirectToTasks()` on `useClerk()()`, send the user to them. Core 3 treats a session with pending tasks as signed out.
  - **New: `HandleSSOCallback`** finishes an OAuth or enterprise SSO sign-in or sign-up on its callback route with the Core 3 resources. It resolves a pending bot-protection check, then finalizes, transfers between sign-in and sign-up, or hands off to your sign-in or sign-up page. `useClerk()()` also gains `setProtectAssertion()` and the protect-check members it uses.

## 3.3.0

### Minor Changes

- 25267f2: SolidStart 2 server parity.

  - **h3 middleware:** `clerkMiddleware()` works as a SolidStart 2 h3 middleware: `createMiddleware([clerkMiddleware()])`. The `createMiddleware({ onRequest: [...] })` form, and calling it with a FetchEvent yourself, work as before.
  - **Response headers:** in both forms, Clerk's response headers (session-refresh cookies and `x-clerk-auth-*`) now reach every response, including 4xx and 5xx ones, errors and h3's 404. They used to be dropped from those.
  - **Options:** every `authenticateRequest()` option is forwarded, such as `organizationSyncOptions`, `satelliteAutoSync`, `clockSkewInMs`, `jwksCacheTtlInMs`, `skipJwksCache`, `headerType`, `issuer` and `machineSecretKey`. Options can come from a function called per request with `{ url, event }`.
  - **Env:** variables are read per request through `@clerk/shared/getEnvVariable`, which adds the `globalThis` fallback and reads the request's Cloudflare bindings, where nitro puts them. It also adds `CLERK_MACHINE_SECRET_KEY`, `CLERK_UNSAFE_DISABLE_DEVELOPMENT_MODE_CONSOLE_WARNING` and `CLERK_CHECKOUT_CONTINUE_URL`. `@clerk/backend` is now ^3.25.
  - **Typed `auth()`:** it is typed like `@clerk/backend`'s `GetAuthFnNoRequest`, so `const { userId } = auth()` type-checks. It takes `{ acceptsToken, treatPendingAsSignedOut }`. API keys, M2M tokens and OAuth access tokens are authenticated, and `auth({ acceptsToken: 'api_key' })` returns them. `auth()` with no options still returns the session object.
  - **Redirect helpers:** session auth objects have `redirectToSignIn()` and `redirectToSignUp()`. You can `throw` them from a `"use server"` query, and they come back to the current page.
  - **`event.locals.auth` typing:** add `/// <reference types="@resonant-projects/clerk-solidjs/start/env" />` to a `.d.ts` file to type `event.locals.auth` through `App.RequestEventLocals`. It replaces the old augmentation, which typed nothing. The typing is opt-in, so an app that declares its own `auth` there keeps compiling.
  - **New `./webhooks` entry:** it exports `verifyWebhook`.
  - **`/start/server` exports:** `clerkClient(options?)` takes optional options and reads the env when called. `/start/server` also exports `verifyToken`, `createClerkClient`, `reverificationError`, `reverificationErrorResponse` and the `ClerkMiddlewareOptions` type. A missing secret key or middleware now gives an actionable error.
  - **`/start` components:** `/start` exports `SignIn`, `SignUp`, `UserProfile`, `OrganizationProfile` and `OrganizationList` with path routing taken from the route that renders them. On a catch-all route they need no `path` prop, and the path follows the route's parameters.
  - **Navigation:** the SolidStart `ClerkProvider`'s navigation now resolves once the router has finished navigating. It used to resolve immediately, and its resolver list grew without bound.

## 3.2.0

### Minor Changes

- 7dfd051: Clerk Core 3 components and load status.

  - **`<Show>`**, also exported as `ClerkShow`, is Core 3's replacement for `SignedIn`, `SignedOut` and `Protect`. `when` takes `'signed-in'`, `'signed-out'`, a role, permission, feature or plan check, or a `has` predicate. It renders nothing until auth loads and creates its children only once they are authorized. `SignedIn`, `SignedOut` and `Protect` keep working as deprecated wrappers over it, so they no longer create protected children for unauthorized users. A bare `<Protect>` now shows its children to any signed-in user. Like `<Show>`, Protect renders nothing, not its fallback, while Clerk loads. The wrappers are removed in 4.0.
  - **Load status.** `ClerkLoading` now goes away when clerk-js fails to load, and the new `ClerkFailed` and `ClerkDegraded` cover the `error` and `degraded` states. `useAuth().getToken()` and `signOut()` wait for Clerk to be ready, and `getToken()` throws `clerk_runtime_not_browser` on the server instead of never resolving.
  - **Buttons** render on the server and before Clerk loads; a click before load runs once Clerk is ready. Your own element passed as the child gets the click instead of being wrapped in a second `<button>`. `initialValues`, `withSignUp`, `oauthFlow`, `appearance`, `unsafeMetadata` and the cross-flow redirect URLs reach Clerk instead of the DOM.
  - **UI components** render their element (tagged `data-clerk-component`) on the server and before load, and take a `fallback` that shows until Clerk has rendered. `Waitlist` is typed with `WaitlistProps`.
  - **`appearance`** is typed with Core 3's theme (`theme`, `options`, `variables`, `elements`, `captcha`) on `ClerkProvider` and every component; the Core 2 `baseTheme` and `layout` keys are type errors. No `@clerk/ui` install is needed for the types.
  - **`publishableKey`** is optional and falls back to `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY`. A missing or malformed key now fails the render on the server too, not only in the browser.
  - The Core 2 `afterSignInUrl` and `afterSignUpUrl` props, which clerk-js 6 ignores, now stand in for the fallback redirect URLs with a deprecation warning. `RedirectToUserProfile`, `RedirectToOrganizationProfile` and `RedirectToCreateOrganization` warn that they are deprecated, and every redirect component runs once instead of again when a prop changes.
  - IsomorphicClerk follows `@clerk/react`'s `LoadedClerk` contract, exposes `status` and `on`/`off`, and passes `sdkMetadata` to clerk-js even under the SolidStart provider, which now identifies itself as `@resonant-projects/clerk-solidjs/start`. The SolidStart provider also reads the env proxy URL and telemetry settings. The experimental `__experimental_nextTask`, `__experimental_commerce` and `__experimental_mount`/`unmountPricingTable` members are removed.
  - Hooks record their telemetry event once, including `useUser`, `useSession` and `useSessionList`, which recorded none.
  - **Package:** a `development` build, `sideEffects: false` (nothing runs at import), `types` beside every export path, a `./package.json` export, every public prop type exported, and `engines.node >=22.12`.

## 3.1.0

### Minor Changes

- 400e553: Fix features that did not work against Clerk Core 3 and SolidStart 2.

  - Prop changes reach Clerk. Changing `appearance` or `localization` on `ClerkProvider`, or any prop of a mounted component, including custom pages and menu items, now updates it. Clerk Core 3 renamed the method this package called, so these changes were silently dropped.
  - `useOrganization` and `useOrganizationList` load their lists. Pages and infinite lists work like `@clerk/react`: they are cached and shared across components, keep the previous page while loading when `keepPreviousData` is set, and are cleared when the user signs out. `fetchPage` is new. `useOrganization().isLoaded` is no longer inverted, so `membership` and the lists resolve. The package no longer depends on `@tanstack/solid-query`, so a page change no longer suspends the nearest `<Suspense>`.
  - A session with pending tasks, such as choosing an organization, counts as signed out in `useAuth`, `<SignedIn>`, `<SignedOut>` and `<Protect>`, as in Clerk Core 3 and on the server. Pass `treatPendingAsSignedOut: false` to them to keep it signed in. `useSession().isSignedIn()` is `false` for such a session while `session()` still returns it, as in `@clerk/react`.
  - `has()` checks features, plans and reverification, requires every requested role and permission, adds the `org:` prefix, and returns `false` instead of throwing when called without a role or permission. `useAuth` adds `orgSlug` and `sessionClaims`.
  - `useUser` and `useSession` report `isSignedIn` as `undefined` while Clerk loads, instead of `true`.
  - SolidStart: the server's auth state reaches the browser before hydration, so signed-in content no longer flashes away, and the publishable key and URLs the middleware resolved reach the client. Clerk's response headers, including refreshed session cookies, reach the response.
  - clerk-js load errors are no longer stripped from production builds.

## 3.0.0

### Major Changes

- 0a68465: First release as `@resonant-projects/clerk-solidjs`, on Clerk Core 3.

  - The provider loads Clerk's prebuilt components from `@clerk/ui` after `clerk-js`, so `SignIn`, `UserButton` and the other components mount under Core 3. Pass `ui` to bundle `@clerk/ui`, or `prefetchUI={false}` to skip it.
  - `UserButton.MenuItems`, `UserButton.Action` and `UserButton.Link` add custom menu items. `UserButton.UserProfilePage`, `UserProfile.Page`, `OrganizationProfile.Page`, `OrganizationSwitcher.OrganizationProfilePage` and the matching `Link` components add custom pages. They take the same props as `@clerk/react`, and their icons and page bodies keep your app's context. `<UserProfileModal>` opens the profile modal with the same custom pages, for example on a given page with `__experimental_startPath`.
  - **Breaking:** `clerkJSUrl`, `clerkJSVersion` and `clerkJSVariant` are no longer `ClerkProvider` props. With the SolidStart provider, set `CLERK_JS_URL`, `CLERK_JS_VERSION`, `CLERK_UI_URL`, `CLERK_UI_VERSION` or `CLERK_PREFETCH_UI=false` instead.
  - **Breaking:** requires Node.js 22 or later.

## 2.3.0

### Minor Changes

- 275b27e: Upgrade deps and fix issues from the upgrade

## 2.2.0

### Minor Changes

- 766ec60: Added Waitlist component

## 2.1.0

### Minor Changes

- a8e40c2: Dependency updates

## 2.0.10

### Patch Changes

- 6d5f58a: Update dependencies

## 2.0.9

### Patch Changes

- f391fe1: Dependency updates

## 2.0.8

### Patch Changes

- 51f6e19: Update Dependencies

## 2.0.7

### Patch Changes

- 5277948: dependency bumps

## 2.0.6

### Patch Changes

- 35a819a: update dependencies

## 2.0.5

### Patch Changes

- 835699b: Update dependencies

## 2.0.4

### Patch Changes

- b4d4d47: Add some in-code documentation

## 2.0.3

### Patch Changes

- 97efc9e: Dependency updates
- dbe3a4a: Fix CI issues and isomorphic clerk updates

## 2.0.2

### Patch Changes

- cec1e6d: Update dependencies

## 2.0.1

### Patch Changes

- a6f51d8: Update deps

## 2.0.0

### Major Changes

- 69a85bd: Refactor solid start code

## 1.2.1

### Patch Changes

- c73195c: Update all deps

## 1.2.0

### Minor Changes

- b0f0f1c: Fixing reactive props

## 1.1.18

### Patch Changes

- fc47cbf: Fix reactivity, bump deps

## 1.1.17

### Patch Changes

- 41d8f77: Add capabilities to isomorphic clerk to match react

## 1.1.16

### Patch Changes

- 43bd09c: Use shared clerk functions

## 1.1.15

### Patch Changes

- efdef59: Update README to adjust support contact options

## 1.1.14

### Patch Changes

- f28555e: Bump dependencies

## 1.1.13

### Patch Changes

- 1b89ee5: Bump deps

## 1.1.12

### Patch Changes

- 1564e86: Bump deps

## 1.1.11

### Patch Changes

- 8011ddc: Bump dependencies

## 1.1.10

### Patch Changes

- 3413ae1: Bump dependencies

## 1.1.9

### Patch Changes

- 3ba313f: Bump dependencies

## 1.1.8

### Patch Changes

- 3c13e20: Bump deps

## 1.1.7

### Patch Changes

- fb84480: Bump dependencies

## 1.1.6

### Patch Changes

- 9e5638d: Updates @clerk/backend from 1.3.2 to 1.4.1. Updates @clerk/shared from 2.3.3 to 2.4.0

## 1.1.5

### Patch Changes

- 2df1e5d: Dependency updates

## 1.1.4

### Patch Changes

- fb0fce1: Dependency updates

## 1.1.3

### Patch Changes

- 4d256c4: Dependency updates, readme update

## 1.1.2

### Patch Changes

- a1dc7fa: Documentation updates

## 1.1.1

### Patch Changes

- 1ceeb17: Dependency updates

## 1.1.0

### Minor Changes

- 8a7e778: Change ownership to LLC

## 1.0.6

### Patch Changes

- 335f96e: Changing changelog implementation, fixing readme

## 1.0.5

### Patch Changes

- [#26](https://github.com/ian-pascoe/clerk-solidjs/pull/26) [`85df583`](https://github.com/ian-pascoe/clerk-solidjs/commit/85df583095dea1af29c377dff4a33a860f1c3a9f) Thanks [@dependabot](https://github.com/apps/dependabot)! - Dependency update & add provenance to npm

- [#28](https://github.com/ian-pascoe/clerk-solidjs/pull/28) [`eab768b`](https://github.com/ian-pascoe/clerk-solidjs/commit/eab768ba05047c6efa116fa07e22f1f927a23d41) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Cleanup dependency graph

## 1.0.4

### Patch Changes

- [`b39bb70`](https://github.com/ian-pascoe/clerk-solidjs/commit/b39bb70cb2e1bef9f3eed71280540718271cd45a) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Dependency updates

## 1.0.3

### Patch Changes

- [`b1f41ce`](https://github.com/ian-pascoe/clerk-solidjs/commit/b1f41ce733bcd386b4bf6875290f8af4afce9af8) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Add customizable fields to components

- [`952d335`](https://github.com/ian-pascoe/clerk-solidjs/commit/952d335bfe853160f0ebc161644a2f0db920fe17) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Finalize changes

## 1.0.2

### Patch Changes

- [`43d3559`](https://github.com/ian-pascoe/clerk-solidjs/commit/43d3559ead538c8f7b03ec79733692a455f16e7d) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Fixing types and readme

## 1.0.1

### Patch Changes

- [`b6ed275`](https://github.com/ian-pascoe/clerk-solidjs/commit/b6ed2756ba211bc96a3378f973e688b3146e0ac6) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Fix readme

## 1.0.0

### Major Changes

- [`da57f6f`](https://github.com/ian-pascoe/clerk-solidjs/commit/da57f6f0f355f65605d4922d47db81aea241fed8) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - First working version

### Minor Changes

- [`ac671d8`](https://github.com/ian-pascoe/clerk-solidjs/commit/ac671d8d7abefad6b6d02b0c9383461bab3cf97f) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Got it working!!

### Patch Changes

- [`8567c8d`](https://github.com/ian-pascoe/clerk-solidjs/commit/8567c8dba59cb9ce7a6f6c095d688e38b7996014) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Convert to monorepo

- [`17b1d72`](https://github.com/ian-pascoe/clerk-solidjs/commit/17b1d72459a0a3716011a9662b6d2785a6597e68) Thanks [@ian-pascoe](https://github.com/ian-pascoe)! - Tweak tsup
