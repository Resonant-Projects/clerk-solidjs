# Migrating from 3.x to 4.0

4.0 finishes the move to Clerk Core 3. It matches `@clerk/react` 6: the
sign-in and sign-up hooks are signal-based, the Core 2 control components and
redirect props are gone, and the package is ESM only. Each section below shows
the 3.x code and its 4.0 replacement.

## Requirements

- `solid-js` `^1.9`.
- For the `/start` entries: `@solidjs/start` `^2` and `@solidjs/router`
  `>=0.16 <2`. Both are optional peers, so an app without SolidStart does not
  need them.
- An ES module build. 4.0 ships no CommonJS (see below).
- Node.js `>=22.12` on the server.

## `useSignIn()` and `useSignUp()`

They now return Clerk Core 3's signal-based state: the resource, its
`errors`, and a `fetchStatus`, as `@clerk/react` 6's do. Their methods wait for
Clerk to load, so you no longer check `isLoaded` first, and you finish with
`finalize()` instead of `setActive()`.

```tsx
// 3.x
const { isLoaded, signIn, setActive } = useSignIn();

const submit = async () => {
  if (!isLoaded()) return;
  const attempt = await signIn()!.create({ identifier, password });
  if (attempt.status === 'complete') {
    await setActive({ session: attempt.createdSessionId });
  }
};
```

```tsx
// 4.0
const state = useSignIn();
const { signIn, errors } = state;

const submit = async () => {
  await signIn.password({ identifier, password });
  if (signIn.status === 'complete') {
    await signIn.finalize({ navigate: () => navigate('/') });
  }
};

// errors.fields.identifier?.message, state.fetchStatus === 'fetching'
```

`signIn`, `signUp` and `errors` stay current and reactive when destructured.
`fetchStatus` is a string, so read it from the result: `state.fetchStatus`.

To keep the 3.x hooks while you move, import them from the new `/legacy`
entry, like `@clerk/react/legacy`:

```diff
-import { useSignIn, useSignUp } from '@resonant-projects/clerk-solidjs';
+import { useSignIn, useSignUp } from '@resonant-projects/clerk-solidjs/legacy';
```

## `SignedIn`, `SignedOut` and `Protect`

They are removed. `<Show>` replaces all three, as in `@clerk/react` 6. Import
it as `ClerkShow` in files that also use solid-js's `Show`.

```tsx
// 3.x
<SignedIn>
  <UserButton />
</SignedIn>
<SignedOut>
  <SignInButton />
</SignedOut>
<Protect role="org:admin" fallback={<p>Admins only</p>}>
  <AdminPanel />
</Protect>
<Protect condition={(has) => has({ permission: 'org:billing:manage' })}>
  <Billing />
</Protect>
```

```tsx
// 4.0
<Show when="signed-in">
  <UserButton />
</Show>
<Show when="signed-out">
  <SignInButton />
</Show>
<Show when={{ role: 'org:admin' }} fallback={<p>Admins only</p>}>
  <AdminPanel />
</Show>
<Show when={(has) => has({ permission: 'org:billing:manage' })}>
  <Billing />
</Show>
```

A `<Protect>` with no check becomes `<Show when="signed-in">`.
`treatPendingAsSignedOut` works the same way on `<Show>`.

## `afterSignInUrl` and `afterSignUpUrl`

Clerk Core 3 removed them, and 4.0 no longer maps them for you. Use the
fallback or force redirect URLs on `ClerkProvider`, `clerkMiddleware()` and the
components. The `CLERK_AFTER_SIGN_IN_URL` and `CLERK_AFTER_SIGN_UP_URL` env
variables are no longer read; use `CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` and
`CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`.

```diff
 <ClerkProvider
-  afterSignInUrl="/dashboard"
-  afterSignUpUrl="/onboarding"
+  signInFallbackRedirectUrl="/dashboard"
+  signUpFallbackRedirectUrl="/onboarding"
 >
```

## CommonJS

Every entry is ESM only, and `package.json` has no `require` conditions. Each
CommonJS entry used to carry its own copy of the Clerk contexts, so a mix of
`require` and `import` could break `useAuth()` and the components. Load the
package with `import`. A test runner that only loads CommonJS needs its ESM
support turned on, or a transform such as `vite-plugin-solid` in Vitest.

## `__unstable__` members of `useClerk()`

`__unstable__environment`, `__unstable__setEnvironment` and
`__unstable__updateProps` are removed. Use `__internal_environment`,
`__internal_setEnvironment` and `__internal_updateProps`.

## New in 4.0

These need no changes to existing code:

- `useWaitlist()`, Core 3's waitlist hook.
- `useReverification(fetcher)`, which opens Clerk's reverification modal when
  a call needs the user to verify again, then retries.
- Session tasks: `<TaskChooseOrganization>`, `<TaskResetPassword>`,
  `<TaskSetupMFA>`, `<RedirectToTasks>`, and `buildTasksUrl()` and
  `redirectToTasks()` on `useClerk()()`.
- `<HandleSSOCallback>` for an SSO callback route.
- The rest of the Clerk instance on `useClerk()()`, such as
  `authenticateWithBase()`, `authenticateWithSolana()`, `apiKeys` and
  `openInviteMembers()`.
