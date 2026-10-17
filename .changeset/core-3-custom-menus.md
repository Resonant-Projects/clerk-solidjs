---
'@resonant-projects/clerk-solidjs': major
---

First release as `@resonant-projects/clerk-solidjs`, on Clerk Core 3.

- The provider loads Clerk's prebuilt components from `@clerk/ui` after `clerk-js`, so `SignIn`, `UserButton` and the other components mount under Core 3. Pass `ui` to bundle `@clerk/ui`, or `prefetchUI={false}` to skip it.
- `UserButton.MenuItems`, `UserButton.Action` and `UserButton.Link` add custom menu items. `UserButton.UserProfilePage`, `UserProfile.Page`, `OrganizationProfile.Page`, `OrganizationSwitcher.OrganizationProfilePage` and the matching `Link` components add custom pages. They take the same props as `@clerk/react`, and their icons and page bodies keep your app's context.
- **Breaking:** `clerkJSUrl`, `clerkJSVersion` and `clerkJSVariant` are no longer `ClerkProvider` props. With the SolidStart provider, set `CLERK_JS_URL`, `CLERK_JS_VERSION`, `CLERK_UI_URL`, `CLERK_UI_VERSION` or `CLERK_PREFETCH_UI=false` instead.
- **Breaking:** requires Node.js 22 or later.
