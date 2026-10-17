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

- SolidJS `>=1`
- SolidStart `>=1`
- Node.js `>=22`

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

If using Vite, set `VITE_CLERK_PUBLISHABLE_KEY` to your Publishable key in your `.env.local` file to make the environment variable accessible on `process.env` and pass it as the `publishableKey` prop.

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
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  ClerkLoading,
  ClerkLoaded
} from '@resonant-projects/clerk-solidjs';

export default function MyComponent() {
  const { userId } = useAuth();

  return (
    <div>
      <ClerkLoading>
        <p>Loading...</p>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          <UserButton />
          <p>Welcome, {userId()}</p>
        </SignedIn>
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </ClerkLoaded>
    </div>
  );
}
```

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

Clerk provides the `clerkMiddleware` helper function which can be used in `solid-start` middleware.

See [SolidStart middleware](https://docs.solidjs.com/solid-start/advanced/middleware) for how to enable middleware.

```ts
// middleware.ts

import { createMiddleware } from '@solidjs/start/middleware';
import { clerkMiddleware } from '@resonant-projects/clerk-solidjs/start/server';

export default createMiddleware({
  onRequest: [
    clerkMiddleware({
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY
    })
    // ... other middleware
  ]
});
```

### The `auth()` Helper

Once your have the `clerkMiddleware` middleware enabled, you can use the `auth()` helper to access the `AuthReturn` object.

```ts
import { auth } from '@resonant-projects/clerk-solidjs/start/server';

async function myProtectedServerFunction() {
  'use server';
  const { userId } = auth();
  if (!userId) {
    throw new Error('You must be signed in');
  }

  // ...
}
```

If you would like the access the auth object from `event.locals` directly, you must add this to your globals.d.ts file:

```ts
/// <reference types="@solidjs/start/server" />
import { AuthObject } from '@clerk/backend';

declare module '@solidjs/start/server' {
  export interface RequestEventLocals {
    auth: AuthObject;
  }
}

export {};
```

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
