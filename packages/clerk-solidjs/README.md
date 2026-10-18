<div align="center">

<img src="https://raw.githubusercontent.com/Resonant-Projects/clerk-solidjs/master/assets/images/icon.svg" alt="clerk-solidjs">

---

_This is an unofficial community-led port of the [Clerk React SDK](https://www.npmjs.com/package/@clerk/react) for [SolidJS](https://solidjs.com) and [SolidStart](https://start.solidjs.com)._

_Maintained by Resonant Projects as a hard fork of [`clerk-solidjs`](https://github.com/spiritledsoftware/clerk-solidjs) by Ian Pascoe, which is no longer published._

[![Clerk documentation](https://img.shields.io/badge/documentation-clerk-lavender.svg?style=for-the-badge&logo=clerk)](https://clerk.com/docs?utm_source=github&utm_medium=clerk_solidjs)

### Released on NPM

[![NPM version](https://img.shields.io/npm/v/@resonant-projects/clerk-solidjs.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@resonant-projects/clerk-solidjs)
[![NPM Downloads](https://img.shields.io/npm/dm/@resonant-projects/clerk-solidjs?style=for-the-badge)
](https://www.npmjs.com/package/@resonant-projects/clerk-solidjs)

### Maintained on GitHub

[![GitHub stars](https://img.shields.io/github/stars/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/stargazers)
[![GitHub watchers](https://img.shields.io/github/watchers/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/watchers)
[![GitHub license](https://img.shields.io/github/license/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/blob/master/LICENSE)
[![GitHub forks](https://img.shields.io/github/forks/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/forks)
[![GitHub issues](https://img.shields.io/github/issues/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/pulls)
[![GitHub contributors](https://img.shields.io/github/contributors/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)](https://github.com/Resonant-Projects/clerk-solidjs/graphs/contributors)
![GitHub last commit](https://img.shields.io/github/last-commit/Resonant-Projects/clerk-solidjs.svg?style=for-the-badge)

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-yellow.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)
[![turborepo](https://img.shields.io/badge/built%20with-turborepo-cc00ff.svg?style=for-the-badge&logo=turborepo)](https://turborepo.org/)

</div>

---

## Overview

Clerk is the easiest way to add authentication and user management to your application. Add sign up, sign in, and profile management to your application in minutes.

## Features

This project tracks [Clerk Core 3](https://clerk.com/docs) and `@clerk/react`:  
&#10004; SSR support  
&#10004; [Components](https://clerk.com/docs/components/overview), with the prebuilt UI loaded from `@clerk/ui`  
&#10004; [Custom menu items](#custom-menu-items-and-pages) in `<UserButton />`  
&#10004; [Custom pages](#custom-menu-items-and-pages) in `<UserProfile />`, `<UserButton />`, `<OrganizationProfile />` and `<OrganizationSwitcher />`  
&#10004; [Hooks](https://clerk.com/docs/references/react/use-user)\*

Plus additional features for SolidStart:  
&#10004; [Middleware](#middleware)  
&#10004; [Server-side `auth()` helper](#the-auth-helper)

\* = Hooks with parameters have been altered to use the `Accessor<Params>` type for reactivity. For example:

```ts
useOrganizationList(() => ({ userMemberships: { infinite: true } }));
```

## Getting Started

### Prerequisites

- SolidJS `^1.9`
- SolidStart `^2` and `@solidjs/router` `>=0.16 <2`, for the `/start`
  entries (optional otherwise)
- Node.js `>=22.12`
- An ES module build: 4.0 ships ESM only

Upgrading from 3.x? See [MIGRATION.md](./MIGRATION.md).

### Installation

```sh
npm install @resonant-projects/clerk-solidjs
# or
yarn add @resonant-projects/clerk-solidjs
# or
pnpm add @resonant-projects/clerk-solidjs
# or
bun add @resonant-projects/clerk-solidjs
```

### Build

```sh
pnpm run build
```

To build the package in watch mode, run the following:

```sh
pnpm run dev
```

## Usage

Clerk requires your application to be wrapped in the `<ClerkProvider />` context.

Set `VITE_CLERK_PUBLISHABLE_KEY` to your Publishable key in your `.env.local` file. `ClerkProvider` reads it, or `CLERK_PUBLISHABLE_KEY`, when you don't pass the `publishableKey` prop. A missing or malformed key fails the render, on the server too.

```tsx
// App.tsx

import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js/web';
import { ClerkProvider } from '@resonant-projects/clerk-solidjs';

import './app.css';

export default function App() {
  return (
    <Router
      root={(props) => (
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
        >
          <Suspense>{props.children}</Suspense>
        </ClerkProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
```

Once you have wrapped your app in `<ClerkProvider />` you can access hooks and components.

```tsx
import {
  ClerkFailed,
  ClerkLoading,
  Show,
  SignInButton,
  UserButton,
  useAuth
} from '@resonant-projects/clerk-solidjs';

export default function MyComponent() {
  const { userId } = useAuth();

  return (
    <div>
      <ClerkLoading>
        <p>Loading...</p>
      </ClerkLoading>
      <ClerkFailed>
        <p>Sign-in is unavailable right now.</p>
      </ClerkFailed>
      <Show when="signed-in" fallback={<SignInButton />}>
        <UserButton fallback={<span>Loading account...</span>} />
        <p>Welcome, {userId()}</p>
      </Show>
    </div>
  );
}
```

### `<Show>`

`<Show>` is Clerk Core 3's replacement for `SignedIn`, `SignedOut` and
`Protect`. `when` takes `'signed-in'`, `'signed-out'`, an authorization check
such as `{ role: 'org:admin' }`, `{ permission: 'org:billing:manage' }`,
`{ feature: 'premium' }` or `{ plan: 'pro' }`, or a function that receives
`has`. It renders nothing until auth has loaded, renders `fallback` when `when`
does not hold, and only creates its children once they are authorized, so their
effects and fetches never run for the wrong user.

It shares its name with solid-js's `Show`. In a file that uses both, import
Clerk's as `ClerkShow`:

```tsx
import { Show } from 'solid-js';
import { ClerkShow } from '@resonant-projects/clerk-solidjs';

<ClerkShow when={{ role: 'org:admin' }} fallback={<p>Admins only</p>}>
  <Show when={settings()}>{(s) => <AdminPanel settings={s()} />}</Show>
</ClerkShow>;
```

4.0 removed `SignedIn`, `SignedOut` and `Protect`; see
[MIGRATION.md](./MIGRATION.md).

### Loading state

`ClerkLoading` shows while Clerk loads, including in the server render.
`ClerkLoaded` shows once Clerk is ready, `ClerkFailed` if clerk-js failed to
load (a blocked script, for example), and `ClerkDegraded` if it loaded but part
of it is not working. `useAuth().getToken()` and `signOut()` wait until Clerk is
ready; on the server, `getToken()` throws `clerk_runtime_not_browser`.

### Buttons and components

`SignInButton`, `SignUpButton`, `SignOutButton` and `SignInWithMetamaskButton`
render on the server and before Clerk loads; a click before then runs once Clerk
is ready. Pass text, or your own element, as the only child. Your element gets
the click handler instead of being wrapped in another button:

```tsx
<SignInButton mode="modal" initialValues={{ emailAddress: email() }}>
  <button class="btn-primary">Log in</button>
</SignInButton>
```

`SignOutButton` without `redirectUrl` goes to your `afterSignOutUrl`;
`@clerk/react`'s goes to `/`.

`SignIn`, `UserButton` and the other Clerk components render their element on
the server too, and take a `fallback` that shows until Clerk has rendered.

### Appearance

`appearance` is typed with Clerk Core 3's theme on `ClerkProvider` and every
component: `theme`, `options`, `variables`, `elements` and `captcha`. The Core 2
`baseTheme` and `layout` keys are type errors. With a bundled `ui` from
`@clerk/ui`, `appearance` follows that version's types.

For redirects after sign-in and sign-up, use `signInFallbackRedirectUrl`,
`signUpFallbackRedirectUrl` and their `Force` variants. 4.0 removed the Core 2
`afterSignInUrl` and `afterSignUpUrl`.

### Signed-in state and authorization

`useAuth()` follows Clerk Core 3. A session that still has tasks to finish, such
as choosing an organization or setting up MFA, counts as signed out. Pass
`treatPendingAsSignedOut: false` to `useAuth` or `<Show>` to treat it as signed
in instead. `<TaskChooseOrganization>`, `<TaskResetPassword>` and
`<TaskSetupMFA>` let the user finish those tasks, and `<RedirectToTasks>` or
`useClerk()().redirectToTasks()` sends them to Clerk's task pages.
`useSession().isSignedIn()` is `false` for such a session, while `session()`
still returns it, as in `@clerk/react`.

`has()` checks roles, permissions, features, plans and reverification together,
and returns `false` for anything it cannot confirm. Call it inside JSX or a memo
to keep it reactive.

```tsx
const { isSignedIn, has } = useAuth();
const canManageMembers = () =>
  has({ permission: 'org:sys_memberships:manage' });
const isPro = () => has({ plan: 'pro' });
```

### Custom sign-in and sign-up flows

`useSignIn()`, `useSignUp()` and `useWaitlist()` are Clerk Core 3's
signal-based hooks, as in `@clerk/react` 6. Each returns the resource,
`errors` and `fetchStatus`, kept current from clerk-js. Their methods wait for
Clerk to load, so a form can call them right away. On the server they return
defaults.

The resource and `errors` stay reactive when destructured. `fetchStatus` is a
string, so read it from the result:

```tsx
import { useNavigate } from '@solidjs/router';
import { useSignIn } from '@resonant-projects/clerk-solidjs';
import { createSignal, Show } from 'solid-js';

export default function SignInForm() {
  const state = useSignIn();
  const { signIn, errors } = state;
  const navigate = useNavigate();
  const [identifier, setIdentifier] = createSignal('');
  const [password, setPassword] = createSignal('');

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    await signIn.password({ identifier: identifier(), password: password() });
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => navigate('/') });
    }
  };

  return (
    <form onSubmit={submit}>
      <input onInput={(e) => setIdentifier(e.currentTarget.value)} />
      <Show when={errors.fields.identifier}>{(e) => <p>{e().message}</p>}</Show>
      <input
        type="password"
        onInput={(e) => setPassword(e.currentTarget.value)}
      />
      <button disabled={state.fetchStatus === 'fetching'}>Sign in</button>
    </form>
  );
}
```

The Core 2 hooks, with `isLoaded`, the client's `signIn` or `signUp` and
`setActive`, are in `@resonant-projects/clerk-solidjs/legacy`, like
`@clerk/react/legacy`.

### SSO callbacks

Render `<HandleSSOCallback>` on the route an OAuth or enterprise SSO provider
redirects back to, such as `src/routes/sso-callback.tsx`. It finishes the
sign-in or sign-up with the Core 3 resources: it resolves a pending
bot-protection check, then finalizes, transfers between sign-in and sign-up,
or calls `navigateToSignIn` or `navigateToSignUp` when another step is needed.

```tsx
import { useNavigate } from '@solidjs/router';
import { HandleSSOCallback } from '@resonant-projects/clerk-solidjs';

export default function SSOCallback() {
  const navigate = useNavigate();
  return (
    <HandleSSOCallback
      navigateToApp={({ decorateUrl }) => {
        // For Safari's cookie cap, decorateUrl can return a Clerk URL.
        const url = decorateUrl('/');
        if (url.startsWith('http')) window.location.href = url;
        else navigate(url);
      }}
      navigateToSignIn={() => navigate('/sign-in')}
      navigateToSignUp={() => navigate('/sign-up')}
    />
  );
}
```

### Reverification

`useReverification(fetcher)` wraps a call that may need the user to verify
again, such as one to a server function that returns `reverificationError()`.
It opens Clerk's reverification modal, then runs the call again once the user
has verified. Pass `onNeedsReverification` to show your own prompt instead.

```tsx
const { user } = useUser();
const setPrimaryEmail = useReverification((emailAddressId: string) =>
  user()!.update({ primaryEmailAddressId: emailAddressId })
);
```

### More components and hooks

As in `@clerk/react`:

- `<PricingTable>` shows your plans; its `fallback` stays until Clerk has
  fetched them.
- `<APIKeys>` manages API keys, and `useAPIKeys()` pages through them:
  `useAPIKeys(() => ({ subject: organization()?.id }))`.
- `<UserAvatar>` is the signed-in user's avatar.
- `<OAuthConsent>` and `useOAuthConsent()` cover an OAuth application's
  consent screen. `<OAuthDeviceVerification>` and
  `useOAuthDeviceVerification()` cover the device flow: `lookup`, then
  `approve` or `deny`.
- `<InviteMembersButton>` opens the invite-members modal.
- `useOrganizationCreationDefaults()` suggests a new organization's name and
  slug, when the instance has that turned on.
- `getToken()` returns the session token outside any component.

Hook params that can change are accessors, and results are accessors, as in
the other hooks. On a development instance without organizations,
`useOrganization()` and `useOrganizationList()` with list params trigger
Clerk's prompt to turn them on.

Wrap part of the app in `<UNSAFE_PortalProvider getContainer={() => el}>` to
render Clerk's components, popovers and modals inside `el`, such as a dialog,
instead of `document.body`.

### Billing (experimental)

Billing is experimental in `@clerk/react` too, so it has its own entry, and its
API can change in a minor release:

```tsx
import { Show } from '@resonant-projects/clerk-solidjs';
import {
  CheckoutButton,
  usePlans
} from '@resonant-projects/clerk-solidjs/experimental';
import { For } from 'solid-js';

const Plans = () => {
  const plans = usePlans(() => ({ for: 'user' }));
  return (
    <Show when="signed-in">
      <For each={plans.data()}>
        {(plan) => (
          <CheckoutButton planId={plan.id} planPeriod="month">
            {`Choose ${plan.name}`}
          </CheckoutButton>
        )}
      </For>
    </Show>
  );
};
```

- `<CheckoutButton>`, `<PlanDetailsButton>` and `<SubscriptionDetailsButton>`
  open Clerk's billing drawers.
- `usePlans()`, `useStatements()`, `usePaymentAttempts()` and
  `usePaymentMethods()` page through billing data, as `useAPIKeys()` does.
  `useSubscription()` returns the current subscription.
- `useCheckout(() => ({ planId, planPeriod }))` drives a custom checkout:
  `checkout.start()`, `confirm()` and `finalize()`. `<CheckoutProvider>` can
  supply its options instead.
- `<PaymentElementProvider>`, `<PaymentElement>` and `usePaymentElement()`
  render Stripe's payment form and submit it. Clerk loads Stripe.js itself.

Render the buttons and `useCheckout()` for a signed-in user, and with
`for="organization"` only with an active organization. Otherwise they throw to
the nearest `ErrorBoundary`. The hooks wait until billing is on for the payer.

### Custom menu items and pages

The components take the same children as `@clerk/react`. Icons and page bodies render
through Solid's `<Portal>` from inside the Clerk component, so your app's context
(router, theme, data clients) is available in them.

```tsx
import { UserButton } from '@resonant-projects/clerk-solidjs';

<UserButton userProfileMode="modal">
  <UserButton.MenuItems>
    <UserButton.Action
      label="Notifications"
      labelIcon={<BellIcon />}
      open="notifications"
    />
    <UserButton.Link label="Docs" labelIcon={<BookIcon />} href="/docs" />
    <UserButton.Action label="manageAccount" />
    <UserButton.Action label="signOut" />
  </UserButton.MenuItems>
  <UserButton.UserProfilePage
    label="Notifications"
    url="notifications"
    labelIcon={<BellIcon />}
  >
    <NotificationSettings />
  </UserButton.UserProfilePage>
  <UserButton.UserProfilePage label="account" />
</UserButton>;
```

- `UserButton.Action` with `open` opens that profile page in the modal; with `onClick` it runs your handler.
  A bare `label` of `manageAccount` or `signOut` reorders Clerk's own items.
- `UserProfile.Page` / `UserProfile.Link`, `OrganizationProfile.Page` / `OrganizationProfile.Link` and
  `OrganizationSwitcher.OrganizationProfilePage` / `.OrganizationProfileLink` work the same way.
  A bare `label` (`account`, `security`, `billing`, `apiKeys`, or `general`, `members` for organizations)
  reorders Clerk's own pages.

To open the profile modal on one of your pages from app code (for example from an old URL), mount
`<UserProfileModal>` with the same page children. It opens Clerk's modal while mounted and closes it
on unmount:

```tsx
<Show when={openAt()} keyed>
  {(path) => (
    <UserProfileModal __experimental_startPath={path}>
      <AccountPages />
    </UserProfileModal>
  )}
</Show>
```

### Clerk UI script

Clerk Core 3 loads the prebuilt components from `@clerk/ui`. The provider loads it from Clerk's CDN
after `clerk-js`. To bundle it instead, pass `ui` from `@clerk/ui`; to skip it (for example when you
only use hooks and control components), pass `prefetchUI={false}`. With the SolidStart provider,
`CLERK_JS_URL`, `CLERK_JS_VERSION`, `CLERK_UI_URL`, `CLERK_UI_VERSION` and `CLERK_PREFETCH_UI=false`
configure the scripts.

### Middleware

`clerkMiddleware()` authenticates every request on the server. Register it in
your [SolidStart middleware](https://docs.solidjs.com/solid-start/advanced/middleware)
with `createMiddleware`, and point your config at the file with
`solidStart({ middleware: './src/middleware.ts' })`:

```ts
// src/middleware.ts
import { createMiddleware } from '@solidjs/start/middleware';
import { clerkMiddleware } from '@resonant-projects/clerk-solidjs/start/server';

export default createMiddleware([clerkMiddleware()]);
```

It reads `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (or
`CLERK_PUBLISHABLE_KEY`) and the other `CLERK_*` variables on each request.
Pass options to override them. Every `authenticateRequest()` option is accepted,
such as `authorizedParties`, `organizationSyncOptions`, `satelliteAutoSync` and
`jwtKey`. When options depend on the request, for example per-tenant keys or
runtime bindings, pass a function. It receives the request's `url` and the
SolidStart `event`:

```ts
export default createMiddleware([
  clerkMiddleware(async ({ url }) => ({
    secretKey: await secretKeyForTenant(url.hostname)
  }))
]);
```

The middleware puts Clerk's response headers on every response, including
session-refresh cookies and `x-clerk-auth-*` diagnostics, and hands the request's
auth state to the browser so the first render matches the server. The older
`createMiddleware({ onRequest: [clerkMiddleware()] })` form still works.

#### Frontend API proxy

Where a network blocks Clerk's Frontend API, serve it from your app:

```ts
clerkMiddleware({ frontendApiProxy: { enabled: true } });
```

Requests under `/__clerk` (set another with `path`) go to Clerk without being
authenticated, and the browser uses the proxy: unless you pass a `proxyUrl`, the
proxy's URL becomes it. `enabled` can be a function of the request URL, such as
`(url) => url.hostname.endsWith('.example.com')`.

#### Content Security Policy

`contentSecurityPolicy` sets a `Content-Security-Policy` header that allows Clerk,
the instance's Frontend API, Stripe and Cloudflare Turnstile. Your `directives`
are merged with Clerk's, and `['none']` replaces a directive. `reportOnly` and
`reportTo` report violations instead of, or as well as, blocking them.

With `strict: true`, scripts need a nonce, which is new for each request and is
in `event.locals.clerkNonce`. Hand it to SolidStart, which adds it to its own
scripts and to the one with Clerk's state:

```tsx
// src/middleware.ts
export default createMiddleware([
  clerkMiddleware({ contentSecurityPolicy: { strict: true } })
]);

// src/entry-server.tsx
export default createHandler(
  () => <StartServer document={/* … */} />,
  (event) => ({ nonce: event.locals.clerkNonce })
);
```

`'strict-dynamic'` then lets those scripts load clerk-js and Clerk's UI.

#### Debugging

`debug: true` logs, for each request, the options, the URL, the request state
and the auth object, between `[clerk debug start]` and `[clerk debug end]` lines.
It leaves credentials out. Keys are cut to their first characters and cookies to
their names. URLs keep their parameter names but no values. Headers keep their
values only when they carry no credentials, such as `host`, `accept` or
`x-clerk-auth-status`; others are listed by name.

#### Server-only code

`@resonant-projects/clerk-solidjs/start/server` is server-only. In a browser
build it resolves to a stand-in with the same exports. A route file can import
`auth` for its `"use server"` functions without bundling `@clerk/backend` into
the browser. Calling `auth()`, `clerkClient()` or the others in the browser
throws an error that says where to call them.

On Netlify, handshake redirects on a development instance carry a cache-busting
parameter, so Netlify does not serve one from its cache in a loop.

### The `auth()` helper

With the middleware in place, `auth()` returns the request's auth object on the
server: in `"use server"` functions and queries, API routes, and middleware
that runs after `clerkMiddleware()`. `event.locals.auth` holds the same session
object. To type it, add this line to a `.d.ts` file in your app, such as
`src/global.d.ts`:

```ts
/// <reference types="@resonant-projects/clerk-solidjs/start/env" />
```

Leave it out if your app already declares `auth` on `App.RequestEventLocals`.

```ts
import { createAsync, query } from '@solidjs/router';
import {
  auth,
  clerkClient
} from '@resonant-projects/clerk-solidjs/start/server';

const getProfile = query(async () => {
  'use server';
  const { userId, redirectToSignIn } = auth();
  // A 307 to sign-in that comes back to this page afterwards.
  if (!userId) throw redirectToSignIn();
  return clerkClient().users.getUser(userId);
}, 'profile');

export default function Profile() {
  const user = createAsync(() => getProfile());
  // ...
}
```

A session with pending tasks counts as signed out unless you pass
`auth({ treatPendingAsSignedOut: false })`. API routes can also accept machine
tokens: API keys, M2M tokens and OAuth access tokens. Set
`CLERK_MACHINE_SECRET_KEY` for M2M tokens.

```ts
// src/routes/api/data.ts
import { auth } from '@resonant-projects/clerk-solidjs/start/server';

export function GET() {
  const { isAuthenticated, tokenType } = auth({
    acceptsToken: ['session_token', 'api_key']
  });
  if (!isAuthenticated) return new Response(null, { status: 401 });
  // ...
}
```

`clerkClient()` is a Backend API client configured from the same env.
`verifyToken`, `createClerkClient`, `reverificationError` and
`reverificationErrorResponse` are exported from `/start/server` too.

### Webhooks

```ts
// src/routes/api/webhooks.ts
import type { APIEvent } from '@solidjs/start/server';
import { verifyWebhook } from '@resonant-projects/clerk-solidjs/webhooks';

export async function POST({ request }: APIEvent) {
  try {
    const event = await verifyWebhook(request); // uses CLERK_WEBHOOK_SIGNING_SECRET
    // event.type, event.data
    return new Response(null, { status: 204 });
  } catch {
    return new Response('Invalid webhook signature', { status: 400 });
  }
}
```

### Routing

`@resonant-projects/clerk-solidjs/start` exports `SignIn`, `SignUp`,
`UserProfile`, `OrganizationProfile` and `OrganizationList` with path routing
taken from the current route. Put them on a catch-all route, such as
`src/routes/sign-in/[...rest].tsx`, and they need no `path` prop. The SolidStart
`ClerkProvider` also makes Clerk's navigation wait until the router has finished
each navigation.

## Examples

### Basic

[Basic example](/examples/basic)

## Support

You can get in touch in any of the following ways:

- Create a [GitHub Issue](https://github.com/Resonant-Projects/clerk-solidjs/issues)
- Create a [GitHub Discussion](https://github.com/Resonant-Projects/clerk-solidjs/discussions)

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read [our contribution guidelines](https://github.com/Resonant-Projects/clerk-solidjs/blob/master/docs/CONTRIBUTING.md).

## Security

`clerk-solidjs` follows good practices of security, but 100% security cannot be assured.

`clerk-solidjs` is provided **"as is"** without any **warranty**. Use at your own risk.

_For more information and to report security issues, please refer to our [security documentation](https://github.com/Resonant-Projects/clerk-solidjs/blob/master/docs/SECURITY.md)._

## License

This project is licensed under the **MIT license**.

See [LICENSE](https://github.com/Resonant-Projects/clerk-solidjs/blob/master/LICENSE) for more information.
